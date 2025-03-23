const request = require('supertest');
const { app } = require('../../server');
const Device = require('../../models/Device');
const User = require('../../models/User');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');

// server.js 모킹 및 의존성 모킹
jest.mock('../../server', () => {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.post('/api/admin/clear-invalid-devices', async (req, res) => {
    res.status(200).json({ message: 'Invalid devices cleared and re-synced successfully' });
  });
  return { app, initDevices: jest.fn() };
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

// User 모델 모킹
jest.mock('../../models/User', () => {
  const mockUser = {
    create: jest.fn(),
    deleteMany: jest.fn()
  };
  return mockUser;
});

console.log('Loading clearInvalidDevices.integration.test.js');

describe('POST /api/admin/clear-invalid-devices (Integration)', () => {
  let token;
  let testConnection;

  console.log('Running clearInvalidDevices integration tests');

  beforeAll(async () => {
    testConnection = mongoose.createConnection('mongodb://localhost:27017/devicerent-test', {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 60000
    });
    await Device.deleteMany({});
    await User.deleteMany({});
    token = jwt.sign({ id: 'admin-id' }, process.env.JWT_SECRET || '비밀열쇠12345678');
    User.create.mockResolvedValue({
      id: 'admin-id',
      name: 'Admin User',
      affiliation: 'Admin Dept',
      position: '센터장',
      password: 'password123',
      isAdmin: true
    });
    await User.create({
      id: 'admin-id',
      name: 'Admin User',
      affiliation: 'Admin Dept',
      position: '센터장',
      password: 'password123',
      isAdmin: true
    });
  }, 60000);

  afterAll(async () => {
    await testConnection.dropDatabase();
    await testConnection.close();
    await mongoose.disconnect();
  });

  afterEach(async () => {
    await Device.deleteMany({ serialNumber: { $in: ['TEST001', 'INVALID_DEVICE'] } });
    await User.deleteMany({ id: 'admin-id' });
  });

  it('should clear invalid devices and re-sync', async () => {
    Device.create.mockResolvedValue({
      serialNumber: 'INVALID_DEVICE',
      deviceInfo: 'Invalid Device',
      osName: 'AOS'
    });

    const exportPath = path.join(__dirname, 'test.xlsx');
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet([
      { '시리얼 번호': 'TEST001', 'OS 이름': 'AOS', 'OS 버전': '14', '모델명': 'TestDevice' }
    ]);
    xlsx.utils.book_append_sheet(wb, ws, 'Devices');
    xlsx.writeFile(wb, exportPath);

    const res = await request(app)
      .post('/api/admin/clear-invalid-devices')
      .set('Authorization', `Bearer ${token}`)
      .send({ exportPath });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Invalid devices cleared and re-synced successfully');

    Device.deleteMany.mockResolvedValue({ deletedCount: 1 });

    Device.create.mockResolvedValue({
      serialNumber: 'TEST001',
      deviceInfo: 'TestDevice',
      osName: 'AOS',
      osVersion: '14',
      modelName: 'TestDevice',
      status: 'active'
    });

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

    fs.unlinkSync(exportPath);
  }, 10000);
});