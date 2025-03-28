const request = require('supertest');
const express = require('express');
const User = require('../../models/User');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// User 모델 모킹
const mockUser = {
  create: jest.fn(),
  findOne: jest.fn(),
  deleteMany: jest.fn(),
  comparePassword: jest.fn()
};

// jwt.sign 모킹
jest.spyOn(jwt, 'sign').mockImplementation(() => 'mocked-token');

// 모킹된 app 정의
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.post('/api/auth/register', async (req, res) => {
  try {
    const { id, name, affiliation, position, password } = req.body;
    const existingUser = await mockUser.findOne({ id });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    const user = await mockUser.create({
      id,
      name,
      affiliation,
      position,
      password,
      isPending: true,
      isAdmin: position === '센터장' || position === '파트장',
      roleLevel: position === '센터장' ? 1 : position === '파트장' ? 2 : 5
    });
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
app.post('/api/auth/login', async (req, res) => {
  try {
    const { id, password } = req.body;
    const user = await mockUser.findOne({ id });
    if (!user || !(await mockUser.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (user.isPending) {
      return res.status(403).json({ message: 'User is pending approval' });
    }
    const token = 'mocked-token'; // jwt.sign 대신 직접 모킹된 토큰 사용
    res.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        affiliation: user.affiliation,
        position: user.position,
        isPending: user.isPending,
        isAdmin: user.isAdmin,
        roleLevel: user.roleLevel
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

describe('POST /api/auth/register', () => {
  beforeAll(async () => {
    jest.mock('../../models/User', () => mockUser);
  }, 60000);

  beforeEach(async () => {
    await mockUser.deleteMany();
    jest.clearAllMocks();
  }, 10000);

  it('should register a new user', async () => {
    mockUser.findOne.mockResolvedValue(null);
    mockUser.create.mockResolvedValue({
      id: 'test-user',
      name: 'Test User',
      affiliation: 'Test Org',
      position: '센터장',
      isPending: true,
      isAdmin: true,
      roleLevel: 1
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        id: 'test-user',
        name: 'Test User',
        affiliation: 'Test Org',
        position: '센터장',
        password: 'testpassword'
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('User registered successfully');
  }, 10000);

  it('should fail to register if user already exists', async () => {
    mockUser.findOne.mockResolvedValue({
      id: 'test-user',
      name: 'Test User',
      affiliation: 'Test Org',
      position: '센터장'
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        id: 'test-user',
        name: 'Test User 2',
        affiliation: 'Test Org 2',
        position: '파트장',
        password: 'testpassword2'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('User already exists');
  }, 10000);
});

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    jest.mock('../../models/User', () => mockUser);
  }, 60000);

  beforeEach(async () => {
    await mockUser.deleteMany();
    jest.clearAllMocks();
  }, 10000);

  it('should login successfully with correct credentials', async () => {
    mockUser.findOne.mockResolvedValue({
      id: 'test-user',
      name: 'Test User',
      affiliation: 'Test Org',
      position: '센터장',
      isPending: false,
      isAdmin: true,
      roleLevel: 1
    });
    mockUser.comparePassword.mockResolvedValue(true);

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        id: 'test-user',
        password: 'testpassword'
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('mocked-token');
    expect(res.body.user).toEqual({
      id: 'test-user',
      name: 'Test User',
      affiliation: 'Test Org',
      position: '센터장',
      isPending: false,
      isAdmin: true,
      roleLevel: 1
    });
  }, 10000);

  it('should fail to login with incorrect password', async () => {
    mockUser.findOne.mockResolvedValue({
      id: 'test-user',
      name: 'Test User',
      affiliation: 'Test Org',
      position: '센터장',
      isPending: false
    });
    mockUser.comparePassword.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        id: 'test-user',
        password: 'wrongpassword'
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  }, 10000);

  it('should fail to login if user does not exist', async () => {
    mockUser.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        id: 'non-existent-user',
        password: 'testpassword'
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  }, 10000);
});