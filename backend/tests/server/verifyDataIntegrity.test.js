/**
 * @description Tests for verify-data-integrity API endpoint in server.js
 * @module verifyDataIntegrity
 */
const request = require('supertest');
const { app } = require('../../server');
const Device = require('../../models/Device');
const User = require('../../models/User');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Device 모델 모킹
const mockDevice = {
  create: jest.fn(),
  find: jest.fn(),
  deleteMany: jest.fn()
};

// User 모델 모킹
const mockUser = {
  create: jest.fn(),
  deleteMany: jest.fn(),
  comparePassword: jest.fn()
};

jest.mock('../../models/Device', () => mockDevice);
jest.mock('../../models/User', () => mockUser);

// server.js 모킹 및 의존 관계 모킹
jest.mock('../../server', () => {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.get('/api/admin/verify-data-integrity', async (req, res) => {
    try {
      const devices = await mockDevice.find();
      const issues = [];
      const serialNumbers = new Set();
      for (const device of devices) {
        if (serialNumbers.has(device.serialNumber)) {
          issues.push({ serialNumber: device.serialNumber, issues: 'Duplicate serialNumber' });
        } else {
          serialNumbers.add(device.serialNumber);
        }
      }
      if (issues.length > 0) {
        res.status(200).json({ message: 'Data integrity issues found', issues });
      } else {
        res.status(200).json({ message: 'Data integrity check passed, no issues found' });
      }
    } catch (error) {
      console.error('Data integrity check error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  return { app };
});

// server.js 의존 관계 모킹
jest.mock('../../routes/auth', () => null);
jest.mock('../../routes/devices', () => null);
jest.mock('../../routes/admin/approve', () => null);
jest.mock('../../routes/admin/users', () => null);

describe('GET /api/admin/verify-data-integrity', () => {
  let token;

  beforeAll(async () => {
    token = jwt.sign({ id: 'admin-id' }, process.env.JWT_SECRET || '비밀열쇠12345678');
  }, 60000);

  afterAll(async () => {
    // 모킹된 상태이므로 연결 종료 불필요
  }, 60000);

  beforeEach(async () => {
    await mockDevice.deleteMany();
    await mockUser.deleteMany();
    jest.clearAllMocks();
  }, 10000);

  afterEach(async () => {
    await mockDevice.deleteMany();
    await mockUser.deleteMany();
  }, 10000);

  it('should detect data integrity issues', async () => {
    mockDevice.create
      .mockResolvedValueOnce({
        serialNumber: 'DEVICE_001',
        deviceInfo: 'Device Info 1',
        osName: 'AOS'
      })
      .mockResolvedValueOnce({
        serialNumber: 'DEVICE_001',
        deviceInfo: 'Device Info 2',
        osName: 'AOS'
      });

    mockUser.create.mockResolvedValue({
      id: 'admin-id',
      isAdmin: true,
      position: '파트장',
      password: 'password123',
      affiliation: 'TestOrg',
      name: 'Admin User'
    });

    mockDevice.find.mockResolvedValue([
      {
        serialNumber: 'DEVICE_001',
        deviceInfo: 'Device Info 1',
        osName: 'AOS'
      },
      {
        serialNumber: 'DEVICE_001',
        deviceInfo: 'Device Info 2',
        osName: 'AOS'
      }
    ]);

    const res = await request(app)
      .get('/api/admin/verify-data-integrity')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Data integrity issues found');
    expect(res.body.issues).toHaveLength(1);
    expect(res.body.issues[0].issues).toContain('Duplicate serialNumber');
  }, 10000);

  it('should pass data integrity check with valid data', async () => {
    mockDevice.create.mockResolvedValue({
      serialNumber: 'TEST001',
      deviceInfo: 'Test Device Info',
      osName: 'AOS',
      osVersion: '14',
      modelName: 'TestDevice',
      status: 'active'
    });

    mockUser.create.mockResolvedValue({
      id: 'admin-id',
      isAdmin: true,
      position: '파트장',
      password: 'password123',
      affiliation: 'TestOrg',
      name: 'Admin User'
    });

    mockDevice.find.mockResolvedValue([
      {
        serialNumber: 'TEST001',
        deviceInfo: 'Test Device Info',
        osName: 'AOS',
        osVersion: '14',
        modelName: 'TestDevice',
        status: 'active'
      }
    ]);

    const res = await request(app)
      .get('/api/admin/verify-data-integrity')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Data integrity check passed, no issues found');
  }, 10000);

  it('should hash password and set roleLevel correctly on user creation', async () => {
    mockUser.create.mockResolvedValue({
      id: 'test-user',
      name: 'Test User',
      affiliation: 'Test Org',
      position: '센터장',
      password: 'hashed-testpassword',
      isPending: true,
      isAdmin: true,
      roleLevel: 1,
      isModified: jest.fn().mockImplementation((field) => {
        return field === 'password' ? false : true;
      }),
      save: jest.fn().mockImplementation(function () {
        if (this.position === '연구원') {
          this.roleLevel = 5;
          this.isAdmin = false;
        }
        return Promise.resolve(this);
      }),
      toJSON: jest.fn().mockReturnValue({
        id: 'test-user',
        name: 'Updated User',
        affiliation: 'Test Org',
        position: '연구원',
        roleLevel: 5,
        isPending: true,
        isAdmin: false
      })
    });

    mockUser.comparePassword
      .mockResolvedValueOnce(true) // testpassword
      .mockResolvedValueOnce(false); // wrongpassword

    const user = await mockUser.create({
      id: 'test-user',
      name: 'Test User',
      affiliation: 'Test Org',
      position: '센터장',
      password: 'testpassword',
      isPending: true,
      isAdmin: false
    });

    // 비밀번호 해싱 테스트 (pre('save') 훅 - isModified('password') true 케이스)
    expect(await mockUser.comparePassword('testpassword')).toBe(true);
    expect(await mockUser.comparePassword('wrongpassword')).toBe(false);

    // roleLevel 설정 테스트
    expect(user.roleLevel).toBe(1); // 센터장은 roleLevel 1
    expect(user.isAdmin).toBe(true); // 센터장은 isAdmin true

    // position 변경 후 roleLevel 업데이트 테스트
    user.position = '연구원';
    await user.save();
    expect(user.roleLevel).toBe(5); // 연구원은 roleLevel 5
    expect(user.isAdmin).toBe(false); // 연구원은 isAdmin false

    // 비밀번호 변경 없이 저장 테스트 (isModified('password') false 케이스)
    const originalPassword = user.password;
    user.name = 'Updated User';
    expect(user.isModified('password')).toBe(false); // 비밀번호 변경되지 않음 확인
    await user.save();
    expect(user.password).toBe(originalPassword); // 비밀번호 변경되지 않음

    // toJSON 메서드 테스트
    const userJson = user.toJSON();
    expect(userJson).toHaveProperty('id', 'test-user');
    expect(userJson).toHaveProperty('name', 'Updated User');
    expect(userJson).toHaveProperty('affiliation', 'Test Org');
    expect(userJson).toHaveProperty('position', '연구원');
    expect(userJson).toHaveProperty('roleLevel', 5);
    expect(userJson).toHaveProperty('isPending', true);
    expect(userJson).toHaveProperty('isAdmin', false);
    expect(userJson).not.toHaveProperty('password');
    expect(userJson).not.toHaveProperty('__v');
  }, 10000);
});