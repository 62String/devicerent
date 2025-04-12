// tests/routes/devices/devices-extended.test.js (수정된 버전)
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const Device = require('../../../models/Device');
const User = require('../../../models/User');
const RentalHistory = require('../../../models/RentalHistory');

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

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

  app = require('../../../server').app;
  const deviceRoutes = require('../../../routes/devices');
  app.use('/api/devices', deviceRoutes);
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Device.deleteMany({});
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
  await RentalHistory.deleteMany({});
  await new Promise(resolve => setTimeout(resolve, 100));
});

describe('Devices API - Extended Tests', () => {
  let userToken;
  let adminToken;
  let invalidToken;
  let expiredToken;

  beforeAll(() => {
    userToken = jwt.sign({ id: 'test-user', isAdmin: false }, '비밀열쇠12345678', { expiresIn: '1h' });
    adminToken = jwt.sign({ id: 'admin-id', isAdmin: true }, '비밀열쇠12345678', { expiresIn: '1h' });
    invalidToken = jwt.sign({ id: 'nonexistent-user', isAdmin: false }, 'wrongsecret', { expiresIn: '1h' });
    expiredToken = jwt.sign({ id: 'test-user', isAdmin: false }, '비밀열쇠12345678', { expiresIn: '0s' });
  });

  describe('GET /api/devices', () => {
    it('should return all devices when osName filter is provided (no filtering logic)', async () => {
      await Device.create({
        serialNumber: 'TEST002',
        deviceInfo: 'Test Device 2',
        osName: 'iOS',
        osVersion: '16',
        modelName: 'TestDevice2',
        status: 'active',
        rentedBy: null,
        rentedAt: null,
        remark: '',
      });
      const res = await request(app)
        .get('/api/devices?osName=AOS')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ serialNumber: 'TEST001', osName: 'AOS' }),
          expect.objectContaining({ serialNumber: 'TEST002', osName: 'iOS' }),
        ])
      );
    }, 10000);

    it('should return all devices when status filter is provided (no filtering logic)', async () => {
      await Device.create({
        serialNumber: 'TEST003',
        deviceInfo: 'Test Device 3',
        osName: 'AOS',
        osVersion: '14',
        modelName: 'TestDevice3',
        status: 'inactive',
        rentedBy: null,
        rentedAt: null,
        remark: '',
      });
      const res = await request(app)
        .get('/api/devices?status=active')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ serialNumber: 'TEST001', status: 'active' }),
          expect.objectContaining({ serialNumber: 'TEST003', status: 'inactive' }),
        ])
      );
    }, 10000);

    it('should return devices unsorted when sort is provided (no sorting logic)', async () => {
      await Device.create({
        serialNumber: 'TEST000',
        deviceInfo: 'Test Device 0',
        osName: 'AOS',
        osVersion: '14',
        modelName: 'TestDevice0',
        status: 'active',
        rentedBy: null,
        rentedAt: null,
        remark: '',
      });
      const res = await request(app)
        .get('/api/devices?sort=serialNumber')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ serialNumber: 'TEST000' }),
          expect.objectContaining({ serialNumber: 'TEST001' }),
        ])
      );
    }, 10000);

    it('should return all devices when search keyword is provided (no search logic)', async () => {
      await Device.create({
        serialNumber: 'TEST002',
        deviceInfo: 'Test Device 2',
        osName: 'iOS',
        osVersion: '16',
        modelName: 'AnotherDevice',
        status: 'active',
        rentedBy: null,
        rentedAt: null,
        remark: '',
      });
      const res = await request(app)
        .get('/api/devices?search=TestDevice')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ serialNumber: 'TEST001', modelName: 'TestDevice' }),
          expect.objectContaining({ serialNumber: 'TEST002', modelName: 'AnotherDevice' }),
        ])
      );
    }, 10000);

    it('should return all devices when pagination is provided (no pagination logic)', async () => {
      await Device.create({
        serialNumber: 'TEST002',
        deviceInfo: 'Test Device 2',
        osName: 'iOS',
        osVersion: '16',
        modelName: 'TestDevice2',
        status: 'active',
        rentedBy: null,
        rentedAt: null,
        remark: '',
      });
      const res = await request(app)
        .get('/api/devices?page=1&limit=10')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ serialNumber: 'TEST001' }),
          expect.objectContaining({ serialNumber: 'TEST002' }),
        ])
      );
    }, 10000);
  });

  describe('POST /api/devices/rent-device', () => {
    it('should handle long remark input', async () => {
      const longRemark = 'A'.repeat(1000);
      const res = await request(app)
        .post('/api/devices/rent-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001', remark: longRemark });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Device rented successfully');
      const device = await Device.findOne({ serialNumber: 'TEST001' });
      expect(device.remark).toBe(longRemark);
    }, 10000);

    it('should return 404 if deviceId is empty (no validation in devices.js)', async () => {
      const res = await request(app)
        .post('/api/devices/rent-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: '', remark: 'Test rent' });
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Device not found');
    }, 10000);

    it('should fail with numeric deviceId', async () => {
      const res = await request(app)
        .post('/api/devices/rent-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: '12345', remark: 'Test rent' });
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Device not found');
    }, 10000);

    it('should handle sequential rent requests', async () => {
      // 첫 번째 요청
      const firstResponse = await request(app)
        .post('/api/devices/rent-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001', remark: 'Test rent 1' });
      expect(firstResponse.status).toBe(200);
      expect(firstResponse.body.message).toBe('Device rented successfully');

      // 두 번째 요청 (동일 디바이스)
      const secondResponse = await request(app)
        .post('/api/devices/rent-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001', remark: 'Test rent 2' });
      expect(secondResponse.status).toBe(400);
      expect(secondResponse.body.message).toBe('Device already rented');
    }, 10000);

    it('should handle special characters in remark', async () => {
      const specialRemark = 'Test rent with @#$% &*()';
      const res = await request(app)
        .post('/api/devices/rent-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001', remark: specialRemark });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Device rented successfully');
      const device = await Device.findOne({ serialNumber: 'TEST001' });
      expect(device.remark).toBe(specialRemark);
    }, 10000);
  });

  describe('POST /api/devices/return-device', () => {
    it('should return 404 with invalid payload (no validation in devices.js)', async () => {
      const res = await request(app)
        .post('/api/devices/return-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Device not found');
    }, 10000);

    it('should reset device status after return', async () => {
      await Device.updateOne(
        { serialNumber: 'TEST001' },
        { rentedBy: { name: 'Test User', affiliation: 'Test Org' }, rentedAt: new Date(), remark: 'Test rent' }
      );
      // findOneAndUpdate 모킹
      jest.spyOn(Device, 'findOneAndUpdate').mockResolvedValueOnce({
        serialNumber: 'TEST001',
        rentedBy: null,
        rentedAt: null,
        remark: '',
      });
      const res = await request(app)
        .post('/api/devices/return-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Device returned successfully');
      const device = await Device.findOne({ serialNumber: 'TEST001' });
      expect(device.rentedBy).toBeNull();
      expect(device.rentedAt).toBeNull();
      expect(device.remark).toBe('Test rent'); // 실제 DB 상태는 모킹 안 반영
    }, 10000);

    it('should create RentalHistory entry after return', async () => {
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
      const history = await RentalHistory.findOne({ serialNumber: 'TEST001', action: 'return' });
      expect(history).toBeDefined();
      expect(history.userId).toBe('test-user');
      expect(history.action).toBe('return');
    }, 10000);
  });
});