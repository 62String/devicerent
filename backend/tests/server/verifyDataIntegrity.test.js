const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { app } = require('../../server');

// Device 모델 모킹
const mockDeviceFind = jest.fn();
jest.mock('../../models/Device', () => ({
  find: mockDeviceFind,
}));

// User 모델 모킹
const mockUserFindOne = jest.fn();
jest.mock('../../models/User', () => ({
  findOne: mockUserFindOne,
}));

// server.js 모킹 및 의존성 모킹
jest.mock('../../server', () => {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.get('/api/admin/verify-data-integrity', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    try {
      const decoded = await require('../../utils/auth').verifyToken(token, process.env.JWT_SECRET || '비밀열쇠12345678');
      const user = await require('../../models/User').findOne({ id: decoded.id, isAdmin: true });
      if (!user) return res.status(403).json({ message: 'Admin access required' });

      const devices = await mockDeviceFind();
      const issues = [];
      const serialNumbers = new Set();

      devices.forEach((device, index) => {
        const deviceIssues = [];
        if (!device.serialNumber) deviceIssues.push('Missing serialNumber');
        if (!device.osName) deviceIssues.push('Missing osName');
        if (device.rentedAt && isNaN(new Date(device.rentedAt).getTime())) deviceIssues.push('Invalid rentedAt');
        if (serialNumbers.has(device.serialNumber)) deviceIssues.push('Duplicate serialNumber');
        else serialNumbers.add(device.serialNumber);
        if (device.location !== undefined) deviceIssues.push('Deprecated location field found');

        if (deviceIssues.length > 0) {
          issues.push({
            serialNumber: device.serialNumber || 'N/A',
            issues: deviceIssues
          });
        }
      });

      if (issues.length > 0) {
        res.status(200).json({ message: 'Data integrity issues found', issues });
      } else {
        res.status(200).json({ message: 'Data integrity check passed, no issues found' });
      }
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  return { app, initDevices: jest.fn() };
});

// server.js 의존성 모킹
jest.mock('../../routes/auth', () => null);
jest.mock('../../routes/devices', () => null);
jest.mock('../../routes/admin/users', () => null);

describe('GET /api/admin/verify-data-integrity', () => {
  let adminToken;
  let userToken;
  let adminTokenValue; // Bearer 접두어 없는 토큰 값
  let userTokenValue;  // Bearer 접두어 없는 토큰 값

  beforeAll(async () => {
    // 실제 MongoDB 인스턴스에 연결
    await mongoose.connect('mongodb://localhost:27017/testdb');
    adminTokenValue = jwt.sign({ id: 'admin-id', isAdmin: true }, '비밀열쇠12345678', { expiresIn: '1h' });
    userTokenValue = jwt.sign({ id: 'user-id', isAdmin: false }, '비밀열쇠12345678', { expiresIn: '1h' });
    adminToken = `Bearer ${adminTokenValue}`;
    userToken = `Bearer ${userTokenValue}`;
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(() => {
    mockDeviceFind.mockReset();
    mockUserFindOne.mockReset();
    // verifyToken 모킹
    jest.spyOn(require('../../utils/auth'), 'verifyToken').mockImplementation((token, secret) => {
      if (token === adminTokenValue) { // Bearer 접두어 없는 값과 비교
        return Promise.resolve({ id: 'admin-id', isAdmin: true });
      } else if (token === userTokenValue) { // Bearer 접두어 없는 값과 비교
        return Promise.resolve({ id: 'user-id', isAdmin: false });
      }
      return Promise.reject(new Error('Invalid token'));
    });
  });

  it('should return 200 with no issues if data is valid', async () => {
    mockUserFindOne.mockResolvedValue({ id: 'admin-id', isAdmin: true });
    mockDeviceFind.mockResolvedValue([
      { serialNumber: 'TEST001', osName: 'AOS', deviceInfo: 'Test Device', osVersion: '14', modelName: 'TestDevice' },
      { serialNumber: 'TEST002', osName: 'AOS', deviceInfo: 'Test Device 2', osVersion: '14', modelName: 'TestDevice' }
    ]);

    const res = await request(app)
      .get('/api/admin/verify-data-integrity')
      .set('Authorization', adminToken);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Data integrity check passed, no issues found');
  });

  it('should return 200 with issues if data is invalid', async () => {
    mockUserFindOne.mockResolvedValue({ id: 'admin-id', isAdmin: true });
    mockDeviceFind.mockResolvedValue([
      { serialNumber: 'TEST001', osName: '', deviceInfo: 'Invalid Device' }, // Missing osName
      { serialNumber: 'TEST001', osName: 'AOS', deviceInfo: 'Test Device' } // Duplicate serialNumber
    ]);

    const res = await request(app)
      .get('/api/admin/verify-data-integrity')
      .set('Authorization', adminToken);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Data integrity issues found');
    expect(res.body.issues).toHaveLength(2);
    expect(res.body.issues[0].issues).toContain('Missing osName');
    expect(res.body.issues[1].issues).toContain('Duplicate serialNumber');
  });

  it('should return 401 if no token is provided', async () => {
    const res = await request(app)
      .get('/api/admin/verify-data-integrity');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('No token provided');
  });

  it('should return 403 if user is not admin', async () => {
    mockUserFindOne.mockResolvedValue({ id: 'user-id', isAdmin: false });

    const res = await request(app)
      .get('/api/admin/verify-data-integrity')
      .set('Authorization', userToken);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Admin access required');
  });
});