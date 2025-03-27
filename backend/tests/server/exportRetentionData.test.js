const exportRetentionData = require('../../server').exportRetentionData;
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// server.js 모킹
jest.mock('../../server', () => {
  const exportRetentionData = jest.requireActual('../../server').exportRetentionData;
  return { exportRetentionData };
});

// auth.js 모킹
jest.mock('../../utils/auth', () => ({
  verifyToken: jest.fn()
}));

// 모델 모킹
jest.mock('../../models/RentalHistory', () => ({
  find: jest.fn(),
  deleteMany: jest.fn(),
}));

jest.mock('../../models/ExportHistory', () => ({
  create: jest.fn(),
}));

jest.mock('../../models/Device', () => ({
  updateMany: jest.fn(),
}));

jest.mock('../../models/User', () => ({
  findOne: jest.fn(),
}));

// fs 모킹
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

describe('exportRetentionData', () => {
  let RentalHistory;
  let ExportHistory;
  let Device;
  const DB_RETENTION_LIMIT = 1000 * 60 * 60 * 24 * 365 * 2;
  const EXPORT_DIR_SERVER = path.resolve(__dirname, 'exports');

  const createHistoryData = (timestamp) => ({
    serialNumber: 'DEVICE001',
    deviceInfo: { modelName: 'Model1', osName: 'AOS', osVersion: '14' },
    userDetails: { name: 'User1' },
    timestamp,
    action: 'rent',
    remark: 'Test remark',
  });

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    RentalHistory = require('../../models/RentalHistory');
    ExportHistory = require('../../models/ExportHistory');
    Device = require('../../models/Device');
    fs.existsSync.mockReturnValue(true);
    fs.mkdirSync.mockImplementation(() => {});
    fs.writeFileSync.mockImplementation(() => {});
    RentalHistory.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn(),
    });
    RentalHistory.deleteMany.mockResolvedValue({ deletedCount: 0 });
    ExportHistory.create.mockResolvedValue({});
    Device.updateMany.mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should do nothing if no data older than 2 years is found', async () => {
    RentalHistory.find().sort().lean.mockResolvedValue([]);

    await exportRetentionData();

    expect(RentalHistory.find).toHaveBeenCalledWith({
      timestamp: { $lte: expect.any(Date) },
    });
    expect(RentalHistory.deleteMany).not.toHaveBeenCalled();
    expect(ExportHistory.create).not.toHaveBeenCalled();
    expect(Device.updateMany).not.toHaveBeenCalled();
  });

  it('should export retention data and delete old records', async () => {
    const oldDate = new Date(Date.now() - DB_RETENTION_LIMIT - 1000);
    const history = [createHistoryData(oldDate)];
    RentalHistory.find().sort().lean.mockResolvedValue(history);
    RentalHistory.deleteMany.mockResolvedValue({ deletedCount: 1 });

    await exportRetentionData();

    expect(RentalHistory.find).toHaveBeenCalledWith({
      timestamp: { $lte: expect.any(Date) },
    });
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(RentalHistory.deleteMany).toHaveBeenCalledWith({
      timestamp: { $lte: expect.any(Date) },
    });
    expect(Device.updateMany).toHaveBeenCalledWith(
      { serialNumber: { $in: ['DEVICE001'] }, rentedAt: { $lte: expect.any(Date) } },
      { $set: { rentedBy: null, rentedAt: null, remark: '' } }
    );
    expect(ExportHistory.create).toHaveBeenCalledWith({
      timestamp: expect.any(Date),
      filePath: expect.any(String),
      recordCount: 1,
      deletedCount: 1,
      performedBy: 'system',
      action: 'export-retention',
      exportType: 'retention',
    });
  });

  it('should handle errors during export', async () => {
    const oldDate = new Date(Date.now() - DB_RETENTION_LIMIT - 1000);
    const history = [createHistoryData(oldDate)];
    RentalHistory.find().sort().lean.mockResolvedValue(history);
    fs.writeFileSync.mockImplementation(() => {
      throw new Error('Failed to save export file');
    });

    await expect(exportRetentionData()).rejects.toThrow('Failed to save export file');
  });
});