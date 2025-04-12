const request = require('supertest');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const express = require('express');
const Device = require('../../../models/Device');
const User = require('../../../models/User');

// verifyToken 모킹
jest.mock('../../../utils/auth', () => ({
  verifyToken: jest.fn().mockImplementation((token, secret) => {
    return { id: 'test-user', isAdmin: false }; // 올바른 decoded 객체 반환
  }),
}));

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // 독립적인 Express 앱 인스턴스 생성
  app = express();
  app.use(express.json());
  const deviceRoutes = require('../../../routes/devices');
  app.use('/api/devices', deviceRoutes);
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongoServer.stop();
  // 비동기 리소스 정리 확인
  await new Promise(resolve => setTimeout(resolve, 1000));
});

beforeEach(async () => {
  await User.deleteMany({});
  await Device.deleteMany({});

  await User.create({
    id: 'test-user',
    name: 'Test User',
    affiliation: 'Test Org',
    position: '연구원',
    password: 'testpassword',
    isPending: false,
    isAdmin: false,
  });

  await Device.create({
    serialNumber: 'TEST001',
    deviceInfo: 'Test Device Info',
    osName: 'AOS',
    osVersion: '14',
    modelName: 'TestDevice',
    status: 'active',
    rentedBy: null,
    rentedAt: null,
    remark: '',
  });
});

describe('Devices API - Other Tests (PATCH and DELETE /api/devices)', () => {
  let userToken;

  beforeAll(() => {
    userToken = jwt.sign({ id: 'test-user', isAdmin: false }, '비밀열쇠12345678', { expiresIn: '1h' });
  });

  describe('PATCH /api/devices', () => {
    it('should update device status successfully', async () => {
      const res = await request(app)
        .patch('/api/devices')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001', status: 'inactive' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Device updated successfully');
      const device = await Device.findOne({ serialNumber: 'TEST001' });
      expect(device.status).toBe('inactive');
    });

    it('should return 401 if no token provided', async () => {
      const res = await request(app)
        .patch('/api/devices')
        .send({ deviceId: 'TEST001', status: 'inactive' });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('No token provided');
    });

    it('should return 404 if device not found', async () => {
      const res = await request(app)
        .patch('/api/devices')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'INVALID', status: 'inactive' });
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Device not found');
    });
  });

  describe('DELETE /api/devices', () => {
    it('should delete device successfully', async () => {
      const res = await request(app)
        .delete('/api/devices')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Device deleted successfully');
      const device = await Device.findOne({ serialNumber: 'TEST001' });
      expect(device).toBeNull();
    });

    it('should return 401 if no token provided', async () => {
      const res = await request(app)
        .delete('/api/devices')
        .send({ deviceId: 'TEST001' });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('No token provided');
    });

    it('should return 404 if device not found', async () => {
      const res = await request(app)
        .delete('/api/devices')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'INVALID' });
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Device not found');
    });
  });
});