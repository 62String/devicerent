// tests/routes/devices/devices-rent.test.js
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

describe('Devices API - Rent Tests (POST /api/devices/rent-device)', () => {
  let userToken;

  beforeAll(() => {
    userToken = jwt.sign({ id: 'test-user', isAdmin: false }, '비밀열쇠12345678', { expiresIn: '1h' });
  });

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
    const firstResponse = await request(app)
      .post('/api/devices/rent-device')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ deviceId: 'TEST001', remark: 'Test rent 1' });
    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body.message).toBe('Device rented successfully');

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

  it('should handle long deviceId', async () => {
    const longDeviceId = 'A'.repeat(100);
    const res = await request(app)
      .post('/api/devices/rent-device')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ deviceId: longDeviceId, remark: 'Test rent' });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Device not found');
  }, 10000);

  it('should handle null remark', async () => {
    const res = await request(app)
      .post('/api/devices/rent-device')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ deviceId: 'TEST001', remark: null });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Device rented successfully');
    const device = await Device.findOne({ serialNumber: 'TEST001' });
    expect(device.remark).toBe(null);
  }, 10000);

  it('should handle deviceId with special characters', async () => {
    const specialDeviceId = 'TEST@#$%';
    const res = await request(app)
      .post('/api/devices/rent-device')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ deviceId: specialDeviceId, remark: 'Test rent' });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Device not found');
  }, 10000);

  it('should handle deviceId with spaces', async () => {
    const spacedDeviceId = 'TEST 001';
    const res = await request(app)
      .post('/api/devices/rent-device')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ deviceId: spacedDeviceId, remark: 'Test rent' });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Device not found');
  }, 10000);

  it('should handle RentalHistory database error', async () => {
    jest.spyOn(Device, 'findOneAndUpdate').mockResolvedValueOnce({
      serialNumber: 'TEST001',
      rentedBy: { name: 'Test User', affiliation: 'Test Org' },
      rentedAt: new Date(),
      remark: 'Test rent',
      modelName: 'TestDevice',
      osName: 'AOS',
      osVersion: '14',
    });
    jest.spyOn(RentalHistory, 'create').mockImplementationOnce(() => {
      throw new Error('Database error');
    });
    const res = await request(app)
      .post('/api/devices/rent-device')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ deviceId: 'TEST001', remark: 'Test rent' });
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Server error');
  }, 10000);
});