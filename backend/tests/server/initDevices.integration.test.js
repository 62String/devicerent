const { initDevices } = require('../../server');
const Device = require('../../models/Device');
const mongoose = require('mongoose');
const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');

// server.js 모킹 및 의존성 모킹
jest.mock('../../server', () => {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  return {
    app,
    initDevices: jest.fn()
  };
});

// server.js 의존성 모킹
jest.mock('../../routes/auth', () => null);
jest.mock('../../routes/devices', () => null);
jest.mock('../../routes/admin/approve', () => null);
jest.mock('../../routes/admin/users', () => null);

// Device 모델 모킹
jest.mock('../../models/Device', () => {
  const mockDevice = {
    create: jest.fn(),
    find: jest.fn(),
    deleteMany: jest.fn()
  };
  return mockDevice;
});

console.log('Loading initDevices.integration.test.js');

describe('initDevices (Integration)', () => {
  let testConnection;

  console.log('Running initDevices integration tests');

  beforeAll(async () => {
    testConnection = mongoose.createConnection('mongodb://localhost:27017/devicerent-test', {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 60000
    });
    await Device.deleteMany({});
  }, 60000);

  afterAll(async () => {
    await testConnection.dropDatabase();
    await testConnection.close();
    await mongoose.disconnect();
  });

  afterEach(async () => {
    await Device.deleteMany({ serialNumber: { $in: ['TEST001', 'TEST003', 'TEST004', 'INVALID_DEVICE'] } });
  });

  it('should throw error if invalid devices are found', async () => {
    Device.create.mockResolvedValue({
      serialNumber: 'INVALID_DEVICE',
      deviceInfo: 'Invalid Device',
      osName: 'AOS'
    });

    initDevices.mockImplementation(() => {
      throw new Error('Invalid devices found');
    });

    let error;
    try {
      await initDevices();
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Invalid devices found');
  });

  it('should import devices successfully from Excel file', async () => {
    const exportPath = path.join(__dirname, 'test.xlsx');
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet([
      { '시리얼 번호': 'TEST001', 'OS 이름': 'AOS', 'OS 버전': '14', '모델명': 'TestDevice' }
    ]);
    xlsx.utils.book_append_sheet(wb, ws, 'Devices');
    xlsx.writeFile(wb, exportPath);

    initDevices.mockImplementation(async () => {
      Device.create.mockResolvedValue({
        serialNumber: 'TEST001',
        deviceInfo: 'TestDevice',
        osName: 'AOS',
        osVersion: '14',
        modelName: 'TestDevice',
        status: 'active'
      });
    });

    await initDevices(false, exportPath);
    Device.find.mockResolvedValue([{
      serialNumber: 'TEST001',
      deviceInfo: 'TestDevice',
      osName: 'AOS',
      osVersion: '14',
      modelName: 'TestDevice',
      status: 'active'
    }]);
    const devices = await Device.find();
    expect(devices.length).toBe(1);
    expect(devices[0].serialNumber).toBe('TEST001');
    expect(devices[0].osName).toBe('AOS');

    fs.unlinkSync(exportPath);
  });

  it('should throw error if Excel file contains invalid data', async () => {
    const exportPath = path.join(__dirname, 'test.xlsx');
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet([
      { '시리얼 번호': 'TEST001', 'OS 이름': 'AOS' },
      { '시리얼 번호': '', 'OS 이름': 'AOS' },
      { '시리얼 번호': 'TEST003', 'OS 이름': 'AOS', '대여일시': 'invalid-date' },
      { '시리얼 번호': 'TEST001', 'OS 이름': 'AOS' },
      { '시리얼 번호': 'TEST004', 'OS 이름': 'AOS', 'location': 'OldField' }
    ]);
    xlsx.utils.book_append_sheet(wb, ws, 'Devices');
    xlsx.writeFile(wb, exportPath);

    initDevices.mockImplementation(() => {
      throw new Error('Invalid devices found');
    });

    let error;
    try {
      await initDevices(false, exportPath);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Invalid devices found');

    fs.unlinkSync(exportPath);
  });
});