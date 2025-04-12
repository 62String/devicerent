// tests/routes/devices/devices-available.test.js
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

describe('Devices API - Available Tests (GET /devices/available)', () => {
  let userToken;

  beforeAll(() => {
    userToken = jwt.sign({ id: 'test-user', isAdmin: false }, '비밀열쇠12345678', { expiresIn: '1h' });
  });

  it('should return devices excluding inactive status', async () => {
    await Device.create({
      serialNumber: 'TEST002',
      deviceInfo: 'Test Device 2',
      osName: 'iOS',
      osVersion: '16',
      modelName: 'TestDevice2',
      status: 'inactive',
      rentedBy: null,
      rentedAt: null,
      remark: '',
    });
    const res = await request(app)
      .get('/api/devices/available')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].serialNumber).toBe('TEST001');
  }, 10000);

  it('should return devices excluding rented devices', async () => {
    await Device.create({
      serialNumber: 'TEST002',
      deviceInfo: 'Test Device 2',
      osName: 'iOS',
      osVersion: '16',
      modelName: 'TestDevice2',
      status: 'active',
      rentedBy: { name: 'Other User', affiliation: 'Other Org' },
      rentedAt: new Date(),
      remark: '',
    });
    const res = await request(app)
      .get('/api/devices/available')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].serialNumber).toBe('TEST001');
  }, 10000);

  it('should return devices excluding inactive devices', async () => {
    await Device.create({
      serialNumber: 'TEST002',
      deviceInfo: 'Test Device 2',
      osName: 'iOS',
      osVersion: '16',
      modelName: 'TestDevice2',
      status: 'inactive',
      rentedBy: null,
      rentedAt: null,
      remark: '',
    });
    const res = await request(app)
      .get('/api/devices/available')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].serialNumber).toBe('TEST001');
  }, 10000);

  it('should handle multiple conditions (rented, inactive)', async () => {
    await Device.create({
      serialNumber: 'TEST002',
      deviceInfo: 'Test Device 2',
      osName: 'iOS',
      osVersion: '16',
      modelName: 'TestDevice2',
      status: 'inactive',
      rentedBy: null,
      rentedAt: null,
      remark: '',
    });
    await Device.create({
      serialNumber: 'TEST003',
      deviceInfo: 'Test Device 3',
      osName: 'AOS',
      osVersion: '14',
      modelName: 'TestDevice3',
      status: 'active',
      rentedBy: { name: 'Other User', affiliation: 'Other Org' },
      rentedAt: new Date(),
      remark: '',
    });
    const res = await request(app)
      .get('/api/devices/available')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].serialNumber).toBe('TEST001');
  }, 10000);

  it('should handle devices with statusReason', async () => {
    await Device.create({
      serialNumber: 'TEST002',
      deviceInfo: 'Test Device 2',
      osName: 'iOS',
      osVersion: '16',
      modelName: 'TestDevice2',
      status: 'inactive',
      statusReason: 'Under repair',
      rentedBy: null,
      rentedAt: null,
      remark: '',
    });
    const res = await request(app)
      .get('/api/devices/available')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].serialNumber).toBe('TEST001');
  }, 10000);

  it('should handle devices with rentedAt in the past', async () => {
    await Device.create({
      serialNumber: 'TEST002',
      deviceInfo: 'Test Device 2',
      osName: 'iOS',
      osVersion: '16',
      modelName: 'TestDevice2',
      status: 'active',
      rentedBy: { name: 'Other User', affiliation: 'Other Org' },
      rentedAt: new Date('2024-01-01'), // 과거 날짜
      remark: '',
    });
    const res = await request(app)
      .get('/api/devices/available')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].serialNumber).toBe('TEST001');
  }, 10000);
});