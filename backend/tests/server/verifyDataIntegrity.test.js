const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { app } = require('../../server');

// 모델 모킹
jest.mock('../../models/Device', () => ({
  find: jest.fn(),
}));

jest.mock('../../models/User', () => ({
  findOne: jest.fn(),
}));

// 의존성 모킹
jest.mock('../../routes/auth', () => null);
jest.mock('../../routes/devices', () => null);
jest.mock('../../routes/admin/users', () => null);

describe('GET /api/admin/verify-data-integrity', () => {
  let adminToken;
  let userToken;
  let adminTokenValue;
  let userTokenValue;
  let mockDeviceFind;
  let mockUserFindOne;

  beforeAll(async () => {
    adminTokenValue = jwt.sign({ id: 'admin-id', isAdmin: true }, '비밀열쇠12345678', { expiresIn: '1h' });
    userTokenValue = jwt.sign({ id: 'user-id', isAdmin: false }, '비밀열쇠12345678', { expiresIn: '1h' });
    adminToken = `Bearer ${adminTokenValue}`;
    userToken = `Bearer ${userTokenValue}`;
  });

  beforeEach(() => {
    mockDeviceFind = require('../../models/Device').find;
    mockUserFindOne = require('../../models/User').findOne;
    mockDeviceFind.mockReset();
    mockUserFindOne.mockReset();
    jest.spyOn(require('../../utils/auth'), 'verifyToken').mockImplementation((token) => {
      if (token === adminTokenValue) return Promise.resolve({ id: 'admin-id', isAdmin: true });
      if (token === userTokenValue) return Promise.resolve({ id: 'user-id', isAdmin: false });
      return Promise.reject(new Error('Invalid token'));
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should return 200 with no issues if data is valid', async () => {
    mockUserFindOne.mockResolvedValue({ id: 'admin-id', isAdmin: true });
    mockDeviceFind.mockResolvedValue([
      { serialNumber: 'TEST001', osName: 'AOS', deviceInfo: 'Test Device' },
      { serialNumber: 'TEST002', osName: 'AOS', deviceInfo: 'Test Device 2' },
    ]);

    const res = await request(app)
      .get('/api/admin/verify-data-integrity')
      .set('Authorization', adminToken);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Data integrity check passed, no issues found');
  });

  it('should return 200 with issues if data is invalid', async () => {
    mockUserFindOne.mockResolvedValue({ id: 'admin-id', isAdmin: true });
    mockDeviceFind.mockResolvedValue([
      { serialNumber: 'TEST001', osName: '', deviceInfo: 'Invalid Device' }, // Missing osName
      { serialNumber: 'TEST001', osName: 'AOS', deviceInfo: 'Test Device' }  // Duplicate serialNumber
    ]);

    const res = await request(app)
      .get('/api/admin/verify-data-integrity')
      .set('Authorization', adminToken);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Data integrity issues found');
    expect(res.body.issues).toHaveLength(2);
    expect(res.body.issues[0].issues).toContain('Missing osName');
    expect(res.body.issues[1].issues).toContain('Duplicate serialNumber');
  });

  it('should return 401 if no token is provided', async () => {
    const res = await request(app).get('/api/admin/verify-data-integrity');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('No token provided');
  });

  it('should return 403 if user is not admin', async () => {
    mockUserFindOne.mockResolvedValue(null);
    mockDeviceFind.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/admin/verify-data-integrity')
      .set('Authorization', userToken);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Admin access required');
  });
});