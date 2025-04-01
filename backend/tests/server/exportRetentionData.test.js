const mongoose = require('mongoose');
const RentalHistory = require('../../models/RentalHistory');
const Device = require('../../models/Device');
const ExportHistory = require('../../models/ExportHistory');
const fs = require('fs');
const xlsx = require('xlsx');

const { exportRetentionData } = jest.requireActual('../../server');

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue(''),
}));

jest.mock('xlsx', () => ({
  utils: {
    book_new: jest.fn().mockReturnValue({}),
    json_to_sheet: jest.fn().mockReturnValue({}),
    book_append_sheet: jest.fn(),
  },
  write: jest.fn().mockReturnValue(Buffer.from('mocked buffer')),
}));

jest.mock('../../models/User', () => ({
  findOne: jest.fn(),
}));

describe('exportRetentionData', () => {
  let connection;

  beforeAll(async () => {
    connection = await mongoose.connect('mongodb://localhost:27017/devicerent-test', {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 60000,
    });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await RentalHistory.deleteMany({});
    await Device.deleteMany({});
    await ExportHistory.deleteMany({});
    fs.writeFileSync.mockReset();
  });

  it('should export and delete retention data older than 2 years', async () => {
    const twoYearsAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 2 - 1000);
    await RentalHistory.create({
      serialNumber: 'TEST001',
      timestamp: twoYearsAgo,
      action: 'rent',
      userId: 'user123',
      userDetails: { name: 'Test User', affiliation: 'Test Dept' },
      deviceInfo: { modelName: 'TestDevice', osName: 'AOS', osVersion: '14' },
    });

    await exportRetentionData();

    const remaining = await RentalHistory.find();
    expect(remaining.length).toBe(0);
    expect(fs.writeFileSync).toHaveBeenCalled();
    const updatedDevice = await Device.findOne({ serialNumber: 'TEST001' });
    expect(updatedDevice).toBeNull();
    const exportEntry = await ExportHistory.findOne({ exportType: 'retention' });
    expect(exportEntry).toMatchObject({ recordCount: 1, deletedCount: 1 });
  });

  it('should do nothing if no retention data exists', async () => {
    await exportRetentionData();

    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(await Device.countDocuments()).toBe(0);
    expect(await ExportHistory.countDocuments()).toBe(0);
  });

  it('should throw error if file write fails', async () => {
    const twoYearsAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 2 - 1000);
    await RentalHistory.create({
      serialNumber: 'TEST001',
      timestamp: twoYearsAgo,
      action: 'rent',
      userId: 'user123',
      userDetails: { name: 'Test User', affiliation: 'Test Dept' },
      deviceInfo: { modelName: 'TestDevice', osName: 'AOS', osVersion: '14' },
    });

    fs.writeFileSync.mockImplementationOnce(() => { throw new Error('Write failed'); });

    await expect(exportRetentionData()).rejects.toThrow('Failed to save export file');
  });
});