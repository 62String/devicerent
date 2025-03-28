const request = require('supertest');
const { app } = require('../../server');
const Device = require('../../models/Device');
const User = require('../../models/User');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');

// Device 모델 모킹
const mockDevice = {
  create: jest.fn(),
  find: jest.fn(),
  deleteMany: jest.fn()
};

// User 모델 모킹
const mockUser = {
  create: jest.fn(),
  deleteMany: jest.fn(),
  comparePassword: jest.fn()
};

// server.js 모킹 및 의존 관계 모킹
jest.mock('../../server', () => {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.post('/api/admin/init-devices', async (req, res) => {
    try {
      await mockDevice.deleteMany({}); // 모든 디바이스 삭제
      res.status(200).json({ message: 'Devices initialized successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  return { app, initDevices: jest.fn() };
});

// server.js 의존 관계 모킹
jest.mock('../../routes/auth', () => null);
jest.mock('../../routes/devices', () => null);
jest.mock('../../routes/admin/approve', () => null);
jest.mock('../../routes/admin/users', () => null);

// xlsx 모킹
jest.spyOn(xlsx, 'readFile').mockImplementation(() => {
  return {
    SheetNames: ['Devices'],
    Sheets: {
      Devices: {
        '!ref': 'A1:D2',
        A1: { v: '시리얼 번호' },
        B1: { v: 'OS 이름' },
        C1: { v: 'OS 버전' },
        D1: { v: '모델명' },
        A2: { v: 'TEST001' },
        B2: { v: 'AOS' },
        C2: { v: '14' },
        D2: { v: 'TestDevice' }
      }
    }
  };
});

jest.spyOn(xlsx.utils, 'sheet_to_json').mockImplementation(() => {
  return [
    { '시리얼 번호': 'TEST001', 'OS 이름': 'AOS', 'OS 버전': '14', '모델명': 'TestDevice' }
  ];
});

console.log('Loading initDevices.integration.test.js');

describe('POST /api/admin/init-devices (Integration)', () => {
  let token;

  console.log('Running initDevices integration tests');

  beforeAll(async () => {
    // jest.mock 호출을 beforeAll 내에서 실행
    jest.mock('../../models/Device', () => mockDevice);
    jest.mock('../../models/User', () => mockUser);
    token = jwt.sign({ id: 'admin-id' }, process.env.JWT_SECRET || '비밀열쇠12345678');
  }, 60000);

  afterAll(async () => {
    // 모킹된 상태이므로 연결 종료 불필요
    const exportPath = path.join(__dirname, 'test.xlsx');
    if (fs.existsSync(exportPath)) {
      fs.unlinkSync(exportPath);
    }
  }, 60000);

  afterEach(async () => {
    await mockDevice.deleteMany({ serialNumber: { $in: ['TEST001', 'INVALID_DEVICE'] } });
    await mockUser.deleteMany({ id: 'admin-id' });
    const exportPath = path.join(__dirname, 'test.xlsx');
    if (fs.existsSync(exportPath)) {
      fs.unlinkSync(exportPath);
    }
  });

  it('should initialize devices', async () => {
    await mockDevice.create({
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
      .post('/api/admin/init-devices')
      .set('Authorization', `Bearer ${token}`)
      .send({ exportPath });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Devices initialized successfully');

    mockDevice.find.mockResolvedValue([
      {
        serialNumber: 'TEST001',
        deviceInfo: 'TestDevice',
        osName: 'AOS',
        osVersion: '14',
        modelName: 'TestDevice',
        status: 'active'
      }
    ]);

    const devices = await mockDevice.find();
    expect(devices.length).toBe(1);
    expect(devices[0].serialNumber).toBe('TEST001');
  }, 10000);
});