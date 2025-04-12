// tests/routes/devices/devices-query.test.js (GET /devices - 추가 쿼리 테스트)
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

describe('Devices API - Query Tests (GET /devices)', () => {
  let userToken;

  beforeAll(() => {
    userToken = jwt.sign({ id: 'test-user', isAdmin: false }, '비밀열쇠12345678', { expiresIn: '1h' });
  });

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

  it('should return all devices when multiple query parameters are provided', async () => {
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
      .get('/api/devices?osName=AOS&status=active&sort=serialNumber')
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