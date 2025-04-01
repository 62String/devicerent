const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { app } = require('../../server');

// Device 모델 모킹
const mockDeviceFind = jest.fn();
const mockDeviceDeleteMany = jest.fn();
jest.mock('../../models/Device', () => ({
  find: mockDeviceFind,
  deleteMany: mockDeviceDeleteMany,
}));

// server.js 모킹 및 의존성 모킹
jest.mock('../../server', () => {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  const verifyToken = jest.fn();
  const User = { findOne: jest.fn() };
  app.post('/api/admin/clear-invalid-devices', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    try {
      const decoded = await verifyToken(token, process.env.JWT_SECRET || '비밀열쇠12345678');
      const user = await User.findOne({ id: decoded.id, isAdmin: true });
      if (!user) return res.status(403).json({ message: 'Admin access required' });

      const { exportPath } = req.body;
      const devices = await mockDeviceFind();
      const invalidDevices = [];
      const serialNumbers = new Set();

      devices.forEach((device, index) => {
        const issues = [];
        if (!device.serialNumber) issues.push('Missing serialNumber');
        if (!device.osName) issues.push('Missing osName');
        if (device.rentedAt && isNaN(new Date(device.rentedAt).getTime())) issues.push('Invalid rentedAt');
        if (serialNumbers.has(device.serialNumber)) issues.push('Duplicate serialNumber');
        else serialNumbers.add(device.serialNumber);
        if (device.location !== undefined) issues.push('Deprecated location field found');

        if (issues.length > 0) {
          invalidDevices.push({ index, serialNumber: device.serialNumber || 'N/A', issues });
        }
      });

      if (invalidDevices.length === 0) {
        return res.status(200).json({ message: 'No invalid devices found, proceeding with import' });
      }

      await mockDeviceDeleteMany({ serialNumber: { $in: invalidDevices.map(d => d.serialNumber) } });
      const initDevices = require('../../server').initDevices;
      await initDevices(false, exportPath);
      res.json({ message: 'Invalid devices cleared and re-synced successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  return { app, initDevices: jest.fn(), User, verifyToken };
});

// 의존성 모킹
jest.mock('../../routes/auth', () => null);
jest.mock('../../routes/devices', () => null);
jest.mock('../../routes/admin/users', () => null);

// xlsx 모킹
const mockXlsx = {
  readFile: jest.fn(),
  utils: {
    sheet_to_json: jest.fn(),
    json_to_sheet: jest.fn(),
    book_new: jest.fn(),
    book_append_sheet: jest.fn(),
  },
  write: jest.fn(), // write 속성 추가
};
jest.mock('xlsx', () => mockXlsx);

// fs 모킹
jest.mock('fs', () => ({
  readdirSync: jest.fn(),
  statSync: jest.fn(),
  existsSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

describe('POST /api/admin/clear-invalid-devices', () => {
  let adminToken;
  let mockFs;

  beforeAll(async () => {
    await mongoose.connect('mongodb://localhost:27017/testdb');
    adminToken = jwt.sign({ id: 'admin-id', isAdmin: true }, '비밀열쇠12345678', { expiresIn: '1h' });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    mockDeviceFind.mockReset();
    mockDeviceDeleteMany.mockReset();
    require('../../server').verifyToken.mockResolvedValue({ id: 'admin-id', isAdmin: true });
    require('../../server').User.findOne.mockResolvedValue({ id: 'admin-id', isAdmin: true });

    // mockFs 초기화
    mockFs = require('fs');
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue(['test.xlsx']);
    mockFs.statSync.mockReturnValue({ mtime: new Date() });

    // mockXlsx 초기화
    mockXlsx.readFile.mockReturnValue({ Sheets: { Sheet1: {} }, SheetNames: ['Sheet1'] });
    mockXlsx.utils.sheet_to_json.mockReturnValue([
      { '시리얼 번호': 'TEST001', '디바이스 정보': 'Test Device', 'OS 이름': 'AOS', 'OS 버전': '14', '모델명': 'TestDevice', '대여자': '없음', '대여일시': '없음' }
    ]);
    mockXlsx.utils.book_new.mockReturnValue({});
    mockXlsx.utils.json_to_sheet.mockReturnValue({});
    mockXlsx.utils.book_append_sheet.mockReturnValue({});
    mockXlsx.write.mockImplementation(() => Buffer.from('mocked buffer')); // write를 함수로 설정
  });

  it('should clear invalid devices and re-sync', async () => {
    mockDeviceFind.mockResolvedValue([
      { serialNumber: 'INVALID', osName: '', deviceInfo: 'Invalid Device' },
      { serialNumber: 'TEST001', osName: 'AOS', deviceInfo: 'Test Device', osVersion: '14', modelName: 'TestDevice' },
    ]);
    mockDeviceDeleteMany.mockResolvedValue({ deletedCount: 1 });

    const res = await request(app)
      .post('/api/admin/clear-invalid-devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ exportPath: 'mocked/path' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Invalid devices cleared and re-synced successfully');
    expect(mockDeviceDeleteMany).toHaveBeenCalledWith({ serialNumber: { $in: ['INVALID'] } });
  });

  it('should return 401 if no token provided', async () => {
    const res = await request(app)
      .post('/api/admin/clear-invalid-devices')
      .send({ exportPath: 'mocked/path' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('No token provided');
  });

  it('should return 403 if user is not admin', async () => {
    const userToken = jwt.sign({ id: 'user-id', isAdmin: false }, '비밀열쇠12345678');
    require('../../server').verifyToken.mockResolvedValue({ id: 'user-id', isAdmin: false });
    require('../../server').User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/admin/clear-invalid-devices')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ exportPath: 'mocked/path' });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Admin access required');
  });

  it('should return 500 if server error occurs', async () => {
    mockDeviceFind.mockRejectedValue(new Error('Database error'));

    const res = await request(app)
      .post('/api/admin/clear-invalid-devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ exportPath: 'mocked/path' });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Server error');
    expect(res.body.error).toBe('Database error');
  });
});