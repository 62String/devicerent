const mongoose = require('mongoose');
const RentalHistory = require('../../models/RentalHistory');
const Device = require('../../models/Device');
const ExportHistory = require('../../models/ExportHistory');
const fs = require('fs');

// server.js에서 exportRetentionData만 가져오기
const { exportRetentionData } = jest.requireActual('../../server');

// fs 모킹
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue(''),
}));

// User.js 모킹 (bcrypt 우회)
jest.mock('../../models/User', () => {
  const mockUserSchema = {
    pre: jest.fn(),
    methods: {
      comparePassword: jest.fn().mockResolvedValue(true),
    },
    set: jest.fn(),
  };
  const mockUser = jest.fn(() => ({
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    isModified: jest.fn().mockReturnValue(false),
    position: '연구원',
    roleLevel: 5,
    isAdmin: false,
  }));
  mockUser.find = jest.fn();
  mockUser.findOne = jest.fn();
  mockUser.findOneAndUpdate = jest.fn();
  mockUser.findOneAndDelete = jest.fn();
  mockUser.create = jest.fn();
  mockUser.schema = mockUserSchema;
  return mockUser;
});

describe('exportRetentionData', () => {
  beforeAll(async () => {
    await mongoose.connect('mongodb://localhost:27017/devicerent-test', {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 60000,
    });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase(); // mongoose.connection 사용
    await mongoose.connection.close(); // 연결 완전 종료
  });

  beforeEach(async () => {
    await RentalHistory.deleteMany({});
    await Device.deleteMany({});
    await ExportHistory.deleteMany({});
    fs.writeFileSync.mockClear();
  });

  it('should export and delete retention data older than 2 years', async () => {
    const twoYearsAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 2 - 1000);
    await RentalHistory.create({
      serialNumber: 'TEST001',
      timestamp: twoYearsAgo,
      action: 'rent',
      userId: 'user123', // 필수 필드 추가
      userDetails: { name: 'Test User', affiliation: 'Test Dept' }, // affiliation 추가
      deviceInfo: { modelName: 'TestDevice', osName: 'AOS', osVersion: '14' }, // osName, osVersion 확인
    });

    await exportRetentionData();

    const remaining = await RentalHistory.find();
    expect(remaining.length).toBe(0);
    expect(fs.writeFileSync).toHaveBeenCalled();
    const updatedDevice = await Device.findOne({ serialNumber: 'TEST001' });
    expect(updatedDevice).toBeNull();
    const exportEntry = await ExportHistory.findOne({ exportType: 'retention' });
    expect(exportEntry).toMatchObject({ recordCount: 1, deletedCount: 1 });
  });

  it('should do nothing if no retention data exists', async () => {
    await exportRetentionData();

    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(await Device.countDocuments()).toBe(0);
    expect(await ExportHistory.countDocuments()).toBe(0);
  });

  it('should throw error if file write fails', async () => {
    const twoYearsAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 2 - 1000);
    await RentalHistory.create({
      serialNumber: 'TEST001',
      timestamp: twoYearsAgo,
      action: 'rent',
      userId: 'user123', // 필수 필드 추가
      userDetails: { name: 'Test User', affiliation: 'Test Dept' }, // affiliation 추가
      deviceInfo: { modelName: 'TestDevice', osName: 'AOS', osVersion: '14' }, // osName, osVersion 추가
    });

    fs.writeFileSync.mockImplementation(() => { throw new Error('Write failed'); });

    await expect(exportRetentionData()).rejects.toThrow('Failed to save export file');
  });
});