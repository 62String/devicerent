const request = require('supertest');
const { exportRetentionData } = require('../../server');
const RentalHistory = require('../../models/RentalHistory');
const Device = require('../../models/Device');
const ExportHistory = require('../../models/ExportHistory');
const mongoose = require('mongoose');
const fs = require('fs');
const xlsx = require('xlsx');

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock('xlsx', () => ({
  utils: {
    book_new: jest.fn(),
    json_to_sheet: jest.fn(),
    book_append_sheet: jest.fn(),
  },
  write: jest.fn().mockReturnValue(Buffer.from('mocked buffer')),
}));

describe('exportRetentionData', () => {
  let testConnection;

  beforeAll(async () => {
    testConnection = mongoose.createConnection('mongodb://localhost:27017/devicerent-test', {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 60000,
    });
    RentalHistory.find = testConnection.model('RentalHistory', RentalHistory.schema).find.bind(
      testConnection.model('RentalHistory', RentalHistory.schema)
    );
    RentalHistory.deleteMany = testConnection.model('RentalHistory', RentalHistory.schema).deleteMany.bind(
      testConnection.model('RentalHistory', RentalHistory.schema)
    );
    Device.updateMany = jest.fn();
    ExportHistory.create = jest.fn();
    fs.existsSync.mockReturnValue(true);
    fs.mkdirSync.mockReturnValue(undefined);
    xlsx.utils.book_new.mockReturnValue({});
    xlsx.utils.json_to_sheet.mockReturnValue({});
    xlsx.utils.book_append_sheet.mockReturnValue({});
  }, 60000);

  afterAll(async () => {
    await testConnection.dropDatabase();
    await testConnection.close();
  }, 60000);

  beforeEach(async () => {
    await testConnection.model('RentalHistory', RentalHistory.schema).deleteMany({});
    fs.writeFileSync.mockReset();
    Device.updateMany.mockReset();
    ExportHistory.create.mockReset();
  });

  it('should export and delete retention data older than 2 years', async () => {
    const twoYearsAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 2 - 1000);
    await testConnection.model('RentalHistory', RentalHistory.schema).create([
      {
        serialNumber: 'TEST001',
        timestamp: twoYearsAgo,
        action: 'rent',
        userDetails: { name: 'Test User' },
        deviceInfo: { modelName: 'TestDevice', osName: 'AOS', osVersion: '14' },
      },
    ]);

    await exportRetentionData();

    const remaining = await testConnection.model('RentalHistory', RentalHistory.schema).find();
    expect(remaining.length).toBe(0);
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(Device.updateMany).toHaveBeenCalledWith(
      { serialNumber: { $in: ['TEST001'] }, rentedAt: { $lte: expect.any(Date) } },
      { $set: { rentedBy: null, rentedAt: null, remark: '' } }
    );
    expect(ExportHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ exportType: 'retention', recordCount: 1, deletedCount: 1 })
    );
  });

  it('should do nothing if no retention data exists', async () => {
    await exportRetentionData();

    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(Device.updateMany).not.toHaveBeenCalled();
    expect(ExportHistory.create).not.toHaveBeenCalled();
  });

  it('should throw error if file write fails', async () => {
    const twoYearsAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 2 - 1000);
    await testConnection.model('RentalHistory', RentalHistory.schema).create([
      {
        serialNumber: 'TEST001',
        timestamp: twoYearsAgo,
        action: 'rent',
        userDetails: { name: 'Test User' },
        deviceInfo: { modelName: 'TestDevice' },
      },
    ]);

    fs.writeFileSync.mockImplementation(() => {
      throw new Error('Write failed');
    });

    await expect(exportRetentionData()).rejects.toThrow('Failed to save export file');
  });
});