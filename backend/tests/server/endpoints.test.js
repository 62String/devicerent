const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const xlsx = require('xlsx');
const { app } = require('../../server');

jest.mock('../../models/Device', () => ({
  find: jest.fn(),
  deleteMany: jest.fn(),
  insertMany: jest.fn(),
}));

jest.mock('../../models/User', () => ({
  findOne: jest.fn(),
}));

jest.mock('../../models/ExportHistory', () => ({
  create: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue(''),
  readdirSync: jest.fn(),
  statSync: jest.fn().mockReturnValue({ mtime: new Date() }),
}));

jest.mock('xlsx', () => ({
  readFile: jest.fn(() => ({ Sheets: { Sheet1: {} }, SheetNames: ['Sheet1'] })),
  utils: {
    sheet_to_json: jest.fn(),
    book_new: jest.fn().mockReturnValue({}),
    json_to_sheet: jest.fn().mockReturnValue({}),
    book_append_sheet: jest.fn(),
  },
  write: jest.fn().mockReturnValue(Buffer.from('mocked buffer')),
}));

describe('server endpoints', () => {
  let connection;
  let adminToken;
  let userToken;

  beforeAll(async () => {
    connection = await mongoose.connect('mongodb://localhost:27017/devicerent-test', {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 60000,
    });
    adminToken = jwt.sign({ id: 'admin-id', isAdmin: true }, '비밀열쇠12345678', { expiresIn: '1h' });
    userToken = jwt.sign({ id: 'user-id' }, '비밀열쇠12345678', { expiresIn: '1h' });
    require('../../models/User').findOne.mockImplementation((query) => {
      if (query.id === 'admin-id') {
        return Promise.resolve({ id: 'admin-id', isAdmin: true });
      }
      if (query.id === 'user-id') {
        return Promise.resolve({ id: 'user-id', isPending: false });
      }
      return Promise.resolve(null);
    });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    require('../../models/Device').find.mockReset();
    require('../../models/Device').deleteMany.mockReset();
    require('../../models/Device').insertMany.mockReset();
    require('../../models/ExportHistory').create.mockReset();
    fs.writeFileSync.mockReset();
    fs.existsSync.mockReturnValue(true);
    fs.readdirSync.mockReturnValue(['test.xlsx']);
    xlsx.utils.sheet_to_json.mockReset();
  });

  it('should return user data for GET /api/data with valid token', async () => {
    const res = await request(app)
      .get('/api/data')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('User data');
    expect(res.body.data).toEqual([{ id: 1, name: 'Device Data' }]);
  });

  it('should return 401 for GET /api/data without token', async () => {
    const res = await request(app).get('/api/data');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('No token provided');
  });

  it('should return 403 for GET /api/data if user is pending', async () => {
    require('../../models/User').findOne.mockResolvedValueOnce({ id: 'user-id', isPending: true });

    const res = await request(app)
      .get('/api/data')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Access denied');
  });

  it('should return user info for GET /api/me with valid token', async () => {
    require('../../models/User').findOne.mockResolvedValueOnce({
      id: 'user-id',
      name: 'Test User',
      affiliation: 'Test Dept',
      isPending: false,
      isAdmin: false,
    });

    const res = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: 'user-id',
      name: 'Test User',
      affiliation: 'Test Dept',
      isPending: false,
      isAdmin: false,
    });
  });

  it('should return 401 for GET /api/me without token', async () => {
    const res = await request(app).get('/api/me');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('No token provided');
  });

  it('should initialize devices via POST /api/admin/init-devices', async () => {
    const mockExcelData = [
      {
        '시리얼 번호': 'TEST002',
        '디바이스 정보': 'Admin Device',
        '모델명': 'Model2',
        'OS 이름': 'AOS',
        'OS 버전': '14',
        '대여자': '없음',
        '대여일시': '없음',
      },
    ];
    const mockDevices = [
      {
        serialNumber: 'TEST002',
        deviceInfo: 'Admin Device',
        modelName: 'Model2',
        osName: 'AOS',
        osVersion: '14',
        status: 'active',
        rentedBy: null,
        rentedAt: null,
      },
    ];
    xlsx.utils.sheet_to_json.mockReturnValue(mockExcelData);
    require('../../models/Device').find.mockResolvedValue([]);
    require('../../models/Device').insertMany.mockResolvedValue(mockDevices);
    require('../../models/ExportHistory').create.mockResolvedValue({
      filePath: '/exports/test.xlsx',
      timestamp: new Date(),
      recordCount: 1,
      deletedCount: 0,
      performedBy: 'system',
      action: 'import',
      exportType: 'device',
      _id: new mongoose.Types.ObjectId(),
    });

    const res = await request(app)
      .post('/api/admin/init-devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ exportPath: 'test.xlsx' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Device initialization completed');
  });

  it('should return 401 for POST /api/admin/init-devices without token', async () => {
    const res = await request(app)
      .post('/api/admin/init-devices')
      .send({ exportPath: 'test.xlsx' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('No token provided');
  });

  it('should clear invalid devices and re-sync via POST /api/admin/clear-invalid-devices', async () => {
    const mockExistingDevices = [
      { serialNumber: 'INVALID', osName: '', deviceInfo: 'Invalid Device' },
      { serialNumber: 'TEST001', osName: 'AOS', deviceInfo: 'Test Device', osVersion: '14', modelName: 'TestDevice' },
    ];
    const mockExcelData = [
      {
        '시리얼 번호': 'TEST001',
        '디바이스 정보': 'Test Device',
        'OS 이름': 'AOS',
        'OS 버전': '14',
        '모델명': 'TestDevice',
        '대여자': '없음',
        '대여일시': '없음',
      },
    ];
    const mockInsertedDevices = [
      {
        serialNumber: 'TEST001',
        deviceInfo: 'Test Device',
        osName: 'AOS',
        osVersion: '14',
        modelName: 'TestDevice',
        status: 'active',
        rentedBy: null,
        rentedAt: null,
      },
    ];
    // find를 두 번 호출하므로 순차적으로 모킹
    let findCallCount = 0;
    require('../../models/Device').find.mockImplementation(() => {
      findCallCount++;
      return findCallCount === 1
        ? Promise.resolve(mockExistingDevices) // 처음 호출: 삭제 전 데이터
        : Promise.resolve([]); // 두 번째 호출: 삭제 후 빈 데이터
    });
    require('../../models/Device').deleteMany.mockResolvedValue({ deletedCount: 1 });
    xlsx.utils.sheet_to_json.mockReturnValue(mockExcelData);
    require('../../models/Device').insertMany.mockResolvedValue(mockInsertedDevices);
    require('../../models/ExportHistory').create.mockResolvedValue({
      filePath: '/exports/test.xlsx',
      timestamp: new Date(),
      recordCount: 1,
      deletedCount: 0,
      performedBy: 'system',
      action: 'import',
      exportType: 'device',
      _id: new mongoose.Types.ObjectId(),
    });

    const res = await request(app)
      .post('/api/admin/clear-invalid-devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ exportPath: 'test.xlsx' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Invalid devices cleared and re-synced successfully');
  });

  it('should return 401 for POST /api/admin/clear-invalid-devices without token', async () => {
    const res = await request(app)
      .post('/api/admin/clear-invalid-devices')
      .send({ exportPath: 'test.xlsx' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('No token provided');
  });

  it('should return 200 with no issues for GET /api/admin/verify-data-integrity if data is valid', async () => {
    require('../../models/Device').find.mockResolvedValue([
      { serialNumber: 'TEST001', osName: 'AOS', deviceInfo: 'Test Device' },
      { serialNumber: 'TEST002', osName: 'AOS', deviceInfo: 'Test Device 2' },
    ]);

    const res = await request(app)
      .get('/api/admin/verify-data-integrity')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Data integrity check passed, no issues found');
  });

  it('should return 200 with issues for GET /api/admin/verify-data-integrity if data is invalid', async () => {
    require('../../models/Device').find.mockResolvedValue([
      { serialNumber: 'TEST001', osName: '', deviceInfo: 'Invalid Device' },
      { serialNumber: 'TEST001', osName: 'AOS', deviceInfo: 'Test Device' },
    ]);

    const res = await request(app)
      .get('/api/admin/verify-data-integrity')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Data integrity issues found');
    expect(res.body.issues).toHaveLength(2);
  });
});