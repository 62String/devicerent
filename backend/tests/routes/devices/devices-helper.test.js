// tests/routes/devices/devices-helper.test.js
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

describe('Devices API - Helper Tests', () => {
  let userToken;

  beforeAll(() => {
    userToken = jwt.sign({ id: 'test-user', isAdmin: false }, '비밀열쇠12345678', { expiresIn: '1h' });
  });

  it('should handle invalid token error (error handling)', async () => {
    const res = await request(app)
      .get('/api/devices')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid token');
  }, 10000);

  it('should handle database error during rent (error handling)', async () => {
    // findOne 모킹
    jest.spyOn(Device, 'findOne').mockResolvedValueOnce({
      serialNumber: 'TEST001',
      rentedBy: null,
      status: 'active',
      modelName: 'TestDevice',
      osName: 'AOS',
      osVersion: '14',
    });
    // findOneAndUpdate 모킹
    jest.spyOn(Device, 'findOneAndUpdate').mockImplementationOnce(() => {
      throw new Error('Database error');
    });
    const res = await request(app)
      .post('/api/devices/rent-device')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ deviceId: 'TEST001', remark: 'Test rent' });
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Server error');
  }, 10000);

  it('should handle database error during return (error handling)', async () => {
    await Device.updateOne(
      { serialNumber: 'TEST001' },
      { rentedBy: { name: 'Test User', affiliation: 'Test Org' }, rentedAt: new Date(), remark: 'Test rent' }
    );
    // findOne 모킹
    jest.spyOn(Device, 'findOne').mockResolvedValueOnce({
      serialNumber: 'TEST001',
      rentedBy: { name: 'Test User', affiliation: 'Test Org' },
      modelName: 'TestDevice',
      osName: 'AOS',
      osVersion: '14',
    });
    // findOneAndUpdate 모킹
    jest.spyOn(Device, 'findOneAndUpdate').mockImplementationOnce(() => {
      throw new Error('Database error');
    });
    const res = await request(app)
      .post('/api/devices/return-device')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ deviceId: 'TEST001' });
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Server error');
  }, 10000);

  it('should handle RentalHistory database error during rent', async () => {
    // findOneAndUpdate 모킹 (성공)
    jest.spyOn(Device, 'findOneAndUpdate').mockResolvedValueOnce({
      serialNumber: 'TEST001',
      rentedBy: { name: 'Test User', affiliation: 'Test Org' },
      rentedAt: new Date(),
      remark: 'Test rent',
      modelName: 'TestDevice',
      osName: 'AOS',
      osVersion: '14',
    });
    // RentalHistory.create 모킹 (에러)
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