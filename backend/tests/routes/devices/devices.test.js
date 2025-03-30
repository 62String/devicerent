const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../../../server');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const Device = require('../../../models/Device');
const User = require('../../../models/User');
const RentalHistory = require('../../../models/RentalHistory');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  await User.create({
    id: 'test-user',
    name: 'Test User',
    affiliation: 'Test Org',
    position: '연구원',
    password: 'testpassword',
    isPending: false,
    isAdmin: false,
  });
  await User.create({
    id: 'admin-id',
    name: 'Admin User',
    affiliation: 'Admin Org',
    position: '센터장',
    password: 'adminpassword',
    isPending: false,
    isAdmin: true,
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

  const deviceRoutes = require('../../../routes/devices');
  app.use('/api/devices', deviceRoutes);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Device.updateOne(
    { serialNumber: 'TEST001' },
    { rentedBy: null, rentedAt: null, remark: '', status: 'active' }
  );
  await RentalHistory.deleteMany({});
});

describe('Devices API', () => {
  let userToken;
  let adminToken;
  let invalidToken;

  beforeAll(() => {
    userToken = jwt.sign({ id: 'test-user', isAdmin: false }, '비밀열쇠12345678', { expiresIn: '1h' });
    adminToken = jwt.sign({ id: 'admin-id', isAdmin: true }, '비밀열쇠12345678', { expiresIn: '1h' });
    invalidToken = jwt.sign({ id: 'nonexistent-user', isAdmin: false }, 'wrongsecret', { expiresIn: '1h' });
  });

  describe('GET /api/devices', () => {
    it('should return list of devices', async () => {
      const res = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].serialNumber).toBe('TEST001');
    });

    it('should return 401 if no token provided', async () => {
      const res = await request(app).get('/api/devices');
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('No token provided');
    });

    it('should return 401 if token is invalid', async () => {
      const res = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${invalidToken}`);
      expect(res.status).toBe(401); // 실제 로직에 맞게 401로 수정
      expect(res.body.message).toBe('Invalid token');
    });
  });

  describe('GET /api/devices/available', () => {
    it('should return list of available devices', async () => {
      const res = await request(app)
        .get('/api/devices/available')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].serialNumber).toBe('TEST001');
    });

    it('should return 404 if no available devices', async () => {
      await Device.updateOne(
        { serialNumber: 'TEST001' },
        { rentedBy: { name: 'Test User', affiliation: 'Test Org' }, rentedAt: new Date() }
      );
      const res = await request(app)
        .get('/api/devices/available')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('No available devices found');
    });
  });

  describe('POST /api/devices/rent-device', () => {
    it('should rent a device successfully', async () => {
      const res = await request(app)
        .post('/api/devices/rent-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001', remark: 'Test rent' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Device rented successfully');
      const device = await Device.findOne({ serialNumber: 'TEST001' });
      expect(device.rentedBy.name).toBe('Test User');
      expect(device.remark).toBe('Test rent');
    });

    it('should fail if device already rented', async () => {
      await Device.updateOne(
        { serialNumber: 'TEST001' },
        { rentedBy: { name: 'Test User', affiliation: 'Test Org' }, rentedAt: new Date() }
      );
      const res = await request(app)
        .post('/api/devices/rent-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Device already rented');
    });

    it('should fail if device not active', async () => {
      await Device.updateOne(
        { serialNumber: 'TEST001' },
        { status: 'inactive' }
      );
      const res = await request(app)
        .post('/api/devices/rent-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Device is not available (inactive)');
    });
  });

  describe('POST /api/devices/return-device', () => {
    it('should return a device successfully', async () => {
      await Device.updateOne(
        { serialNumber: 'TEST001' },
        { rentedBy: { name: 'Test User', affiliation: 'Test Org' }, rentedAt: new Date(), remark: 'Test rent' }
      );
      const res = await request(app)
        .post('/api/devices/return-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Device returned successfully');
      const device = await Device.findOne({ serialNumber: 'TEST001' });
      expect(device.rentedBy).toBeNull();
      expect(device.rentedAt).toBeNull();
    });

    it('should fail if device not rented', async () => {
      const res = await request(app)
        .post('/api/devices/return-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Device is not rented');
    });

    it('should fail if user is not the renter', async () => {
      await Device.updateOne(
        { serialNumber: 'TEST001' },
        { rentedBy: { name: 'Other User', affiliation: 'Other Org' }, rentedAt: new Date() }
      );
      const res = await request(app)
        .post('/api/devices/return-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001' });
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Cannot return this device');
    });
  });
});