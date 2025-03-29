const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../../../server');
const deviceRoutes = require('../../../routes/devices'); // 실제 라우트 가져오기

// 모델 모킹
jest.mock('../../../models/Device', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  deleteMany: jest.fn(),
  updateMany: jest.fn(),
}));

jest.mock('../../../models/RentalHistory', () => ({
  findOne: jest.fn(),
  deleteMany: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../../../models/User', () => ({
  findOne: jest.fn(),
  deleteMany: jest.fn(),
}));

jest.mock('../../../models/ExportHistory', () => ({
  find: jest.fn(),
  create: jest.fn(),
}));

// 테스트 환경에서 라우트 강제 등록
beforeAll(() => {
  app.use('/api/devices', deviceRoutes);
});

describe('Devices API', () => {
  let userToken;
  let adminToken;
  let mockDeviceFind;
  let mockDeviceFindOne;
  let mockDeviceDeleteMany;
  let mockDeviceUpdateMany;
  let mockRentalHistoryFindOne;
  let mockRentalHistoryCreate;
  let mockUserFindOne;
  let mockExportHistoryFind;
  let mockExportHistoryCreate;

  beforeAll(() => {
    userToken = jwt.sign({ id: 'test-user', isAdmin: false }, '비밀열쇠12345678', { expiresIn: '1h' });
    adminToken = jwt.sign({ id: 'admin-id', isAdmin: true }, '비밀열쇠12345678', { expiresIn: '1h' });
  });

  beforeEach(() => {
    mockDeviceFind = require('../../../models/Device').find;
    mockDeviceFindOne = require('../../../models/Device').findOne;
    mockDeviceDeleteMany = require('../../../models/Device').deleteMany;
    mockDeviceUpdateMany = require('../../../models/Device').updateMany;
    mockRentalHistoryFindOne = require('../../../models/RentalHistory').findOne;
    mockRentalHistoryCreate = require('../../../models/RentalHistory').create;
    mockUserFindOne = require('../../../models/User').findOne;
    mockExportHistoryFind = require('../../../models/ExportHistory').find;
    mockExportHistoryCreate = require('../../../models/ExportHistory').create;

    mockDeviceFind.mockReset();
    mockDeviceFindOne.mockReset();
    mockDeviceDeleteMany.mockReset();
    mockDeviceUpdateMany.mockReset();
    mockRentalHistoryFindOne.mockReset();
    mockRentalHistoryCreate.mockReset();
    mockUserFindOne.mockReset();
    mockExportHistoryFind.mockReset();
    mockExportHistoryCreate.mockReset();

    // 기본 사용자 모킹
    mockUserFindOne.mockImplementation((query) => {
      if (query.id === 'test-user') {
        return Promise.resolve({
          id: 'test-user',
          name: 'Test User',
          affiliation: 'Test Org',
          _id: 'mocked-user-id',
          isPending: false,
          isAdmin: false,
        });
      } else if (query.id === 'admin-id' && query.isAdmin === true) {
        return Promise.resolve({
          id: 'admin-id',
          name: 'Admin User',
          affiliation: 'Admin Org',
          _id: 'mocked-admin-id',
          isPending: false,
          isAdmin: true,
        });
      }
      return Promise.resolve(null);
    });

    // 기본 디바이스 모킹
    mockDeviceFindOne.mockImplementation((query) => {
      if (query.serialNumber === 'TEST001') {
        return Promise.resolve({
          serialNumber: 'TEST001',
          deviceInfo: 'Test Device Info',
          osName: 'AOS',
          osVersion: '14',
          modelName: 'TestDevice',
          status: 'active',
          rentedBy: null,
          rentedAt: null,
          remark: '',
          save: jest.fn().mockResolvedValue(true),
        });
      }
      return Promise.resolve(null);
    });

    mockDeviceFind.mockImplementation((query) => {
      if (query && query.status === 'active' && query.rentedBy === null) {
        return Promise.resolve([
          { serialNumber: 'TEST001', deviceInfo: 'Test Device Info', osName: 'AOS', osVersion: '14', modelName: 'TestDevice', status: 'active' },
        ]);
      }
      return Promise.resolve([
        { serialNumber: 'TEST001', deviceInfo: 'Test Device Info', osName: 'AOS', osVersion: '14', modelName: 'TestDevice', status: 'active' },
      ]);
    });

    mockRentalHistoryCreate.mockResolvedValue({});
    mockExportHistoryCreate.mockResolvedValue({});
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

    it('should return 404 if user not found', async () => {
      mockUserFindOne.mockResolvedValue(null);
      const res = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('User not found');
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
      mockDeviceFind.mockResolvedValue([]);
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
      expect(mockRentalHistoryCreate).toHaveBeenCalled();
    });

    it('should fail if device already rented', async () => {
      mockDeviceFindOne.mockResolvedValue({
        serialNumber: 'TEST001',
        rentedBy: { name: 'Test User', affiliation: 'Test Org' },
        save: jest.fn(),
      });
      const res = await request(app)
        .post('/api/devices/rent-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Device already rented');
    });

    it('should fail if device not active', async () => {
      mockDeviceFindOne.mockResolvedValue({
        serialNumber: 'TEST001',
        status: 'inactive',
        save: jest.fn(),
      });
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
      mockDeviceFindOne.mockResolvedValue({
        serialNumber: 'TEST001',
        rentedBy: { name: 'Test User', affiliation: 'Test Org' },
        rentedAt: new Date(),
        remark: 'Test rent',
        status: 'active',
        save: jest.fn().mockResolvedValue(true),
      });
      const res = await request(app)
        .post('/api/devices/return-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Device returned successfully');
      expect(mockRentalHistoryCreate).toHaveBeenCalled();
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
      mockDeviceFindOne.mockResolvedValue({
        serialNumber: 'TEST001',
        rentedBy: { name: 'Other User', affiliation: 'Other Org' },
        save: jest.fn(),
      });
      const res = await request(app)
        .post('/api/devices/return-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001' });
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Cannot return this device');
    });
  });
});