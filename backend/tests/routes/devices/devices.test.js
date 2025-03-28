const request = require('supertest');
const express = require('express');
const Device = require('../../../models/Device'); // 경로 수정
const User = require('../../../models/User'); // 경로 수정
const RentalHistory = require('../../../models/RentalHistory'); // 경로 수정
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const deviceRoutes = require('../../../routes/devices'); // 경로 수정

// 테스트용 app 설정
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/devices', deviceRoutes);

describe('Devices API', () => {
  let mongoServer;
  let token;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 60000
    });
    token = jwt.sign({ id: 'test-user' }, process.env.JWT_SECRET || '비밀열쇠12345678');
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  }, 60000);

  beforeEach(async () => {
    await Device.deleteMany({});
    await User.deleteMany({});
    await RentalHistory.deleteMany({});

    await User.create({
      id: 'test-user',
      name: 'Test User',
      affiliation: 'Test Org',
      position: '연구원',
      password: 'testpassword',
      isPending: false,
      isAdmin: false,
      roleLevel: 5
    });
  }, 10000);

  describe('GET /api/devices', () => {
    it('should return list of devices', async () => {
      await Device.create({
        serialNumber: 'TEST001',
        deviceInfo: 'Test Device Info',
        osName: 'AOS',
        osVersion: '14',
        modelName: 'TestDevice',
        status: 'active'
      });

      const res = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].serialNumber).toBe('TEST001');
    }, 10000);

    it('should return 401 if no token provided', async () => {
      const res = await request(app).get('/api/devices');
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('No token provided');
    }, 10000);
  });

  describe('GET /api/devices/available', () => {
    it('should return list of available devices', async () => {
      await Device.create({
        serialNumber: 'TEST001',
        deviceInfo: 'Test Device Info',
        osName: 'AOS',
        osVersion: '14',
        modelName: 'TestDevice',
        status: 'active',
        rentedBy: null
      });

      const res = await request(app)
        .get('/api/devices/available')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].serialNumber).toBe('TEST001');
    }, 10000);
  });

  describe('POST /api/devices/rent-device', () => {
    it('should rent a device successfully', async () => {
      await Device.create({
        serialNumber: 'TEST001',
        deviceInfo: 'Test Device Info',
        osName: 'AOS',
        osVersion: '14',
        modelName: 'TestDevice',
        status: 'active',
        rentedBy: null
      });

      const res = await request(app)
        .post('/api/devices/rent-device')
        .set('Authorization', `Bearer ${token}`)
        .send({ deviceId: 'TEST001', remark: 'Test rent' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Device rented successfully');

      const device = await Device.findOne({ serialNumber: 'TEST001' });
      expect(device.rentedBy.name).toBe('Test User');
      expect(device.remark).toBe('Test rent');

      const history = await RentalHistory.findOne({ serialNumber: 'TEST001' });
      expect(history.action).toBe('rent');
    }, 10000);

    it('should fail if device already rented', async () => {
      await Device.create({
        serialNumber: 'TEST001',
        deviceInfo: 'Test Device Info',
        osName: 'AOS',
        osVersion: '14',
        modelName: 'TestDevice',
        status: 'active',
        rentedBy: { name: 'Other User', affiliation: 'Other Org' }
      });

      const res = await request(app)
        .post('/api/devices/rent-device')
        .set('Authorization', `Bearer ${token}`)
        .send({ deviceId: 'TEST001' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Device already rented');
    }, 10000);
  });

  describe('POST /api/devices/return-device', () => {
    it('should return a device successfully', async () => {
      await Device.create({
        serialNumber: 'TEST001',
        deviceInfo: 'Test Device Info',
        osName: 'AOS',
        osVersion: '14',
        modelName: 'TestDevice',
        status: 'active',
        rentedBy: { name: 'Test User', affiliation: 'Test Org' },
        rentedAt: new Date()
      });

      const res = await request(app)
        .post('/api/devices/return-device')
        .set('Authorization', `Bearer ${token}`)
        .send({ deviceId: 'TEST001' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Device returned successfully');

      const device = await Device.findOne({ serialNumber: 'TEST001' });
      expect(device.rentedBy).toBeNull();

      const history = await RentalHistory.findOne({ serialNumber: 'TEST001', action: 'return' });
      expect(history).toBeTruthy();
    }, 10000);

    it('should fail if device not rented', async () => {
      await Device.create({
        serialNumber: 'TEST001',
        deviceInfo: 'Test Device Info',
        osName: 'AOS',
        osVersion: '14',
        modelName: 'TestDevice',
        status: 'active',
        rentedBy: null
      });

      const res = await request(app)
        .post('/api/devices/return-device')
        .set('Authorization', `Bearer ${token}`)
        .send({ deviceId: 'TEST001' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Device is not rented');
    }, 10000);
  });
});