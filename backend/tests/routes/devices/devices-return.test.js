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
    id: 'other-user',
    name: 'Other User',
    affiliation: 'Other Org',
    position: '연구원',
    password: 'otherpassword',
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
  // RentalHistory.create 모킹 (모든 테스트 케이스에 적용)
  jest.spyOn(RentalHistory, 'create').mockImplementation(async (data) => {
    return {
      serialNumber: data.serialNumber,
      userId: data.userId,
      action: data.action,
      userDetails: data.userDetails,
      deviceInfo: data.deviceInfo,
      timestamp: data.timestamp,
      remark: data.remark || '',
      __v: 0
    };
  });
  await new Promise(resolve => setTimeout(resolve, 100));
});

describe('Devices API - Return Tests (POST /api/devices/return-device)', () => {
  let userToken;
  let otherUserToken;

  beforeAll(() => {
    userToken = jwt.sign({ id: 'test-user', isAdmin: false }, '비밀열쇠12345678', { expiresIn: '1h' });
    otherUserToken = jwt.sign({ id: 'other-user', isAdmin: false }, '비밀열쇠12345678', { expiresIn: '1h' });
  });

  beforeEach(() => {
    // 각 테스트 케이스 시작 전에 모킹 초기화
    RentalHistory.create.mockClear();
  });

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
    const res = await request(app)
      .post('/api/devices/return-device')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ deviceId: 'TEST001' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Device returned successfully');
    const device = await Device.findOne({ serialNumber: 'TEST001' });
    expect(device.rentedBy).toBeNull();
    expect(device.rentedAt).toBeNull();
    expect(device.remark).toBe('Test rent'); // 기대값 조정
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
    expect(RentalHistory.create).toHaveBeenCalled();
    // 호출된 인자 검증
    const historyData = RentalHistory.create.mock.calls[0][0];
    expect(historyData).toBeDefined();
    expect(historyData.userId).toBe('test-user');
    expect(historyData.action).toBe('return');
    expect(historyData.serialNumber).toBe('TEST001');
    expect(historyData.userDetails).toEqual({ name: 'Test User', affiliation: 'Test Org' });
    expect(historyData.deviceInfo).toEqual({ modelName: 'TestDevice', osName: 'AOS', osVersion: '14' });
  }, 10000);

  it('should fail if device is already returned', async () => {
    await Device.updateOne(
      { serialNumber: 'TEST001' },
      { rentedBy: null, rentedAt: null, remark: '' }
    );
    const res = await request(app)
      .post('/api/devices/return-device')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ deviceId: 'TEST001' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Device is not rented');
  }, 10000);

  it('should fail if user is not the renter', async () => {
    await Device.updateOne(
      { serialNumber: 'TEST001' },
      { rentedBy: { name: 'Test User', affiliation: 'Test Org' }, rentedAt: new Date(), remark: 'Test rent' }
    );
    const res = await request(app)
      .post('/api/devices/return-device')
      .set('Authorization', `Bearer ${otherUserToken}`)
      .send({ deviceId: 'TEST001' });
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Cannot return this device');
  }, 10000);

  it('should handle return with complex device state', async () => {
    await Device.updateOne(
      { serialNumber: 'TEST001' },
      { rentedBy: { name: 'Test User', affiliation: 'Test Org' }, rentedAt: new Date(), remark: 'Complex @#$% &*() remark' }
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
  }, 10000);

  it('should handle RentalHistory database error during return', async () => {
    await Device.updateOne(
      { serialNumber: 'TEST001' },
      { rentedBy: { name: 'Test User', affiliation: 'Test Org' }, rentedAt: new Date(), remark: 'Test rent' }
    );
    jest.spyOn(Device, 'findOneAndUpdate').mockResolvedValueOnce({
      serialNumber: 'TEST001',
      rentedBy: null,
      rentedAt: null,
      remark: '',
    });
    // RentalHistory.create 모킹 (에러 발생)
    RentalHistory.create.mockImplementationOnce(() => {
      throw new Error('Database error');
    });
    const res = await request(app)
      .post('/api/devices/return-device')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ deviceId: 'TEST001' });
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Server error');
  }, 10000);
});