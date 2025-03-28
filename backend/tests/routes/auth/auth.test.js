const request = require('supertest');
const express = require('express');
const User = require('../../../models/User');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const authRoutes = require('../../../routes/auth');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/auth', authRoutes);

describe('Auth API', () => {
  let mongoServer;
  let token;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 60000
    });
    token = jwt.sign({ id: 'test-user' }, process.env.JWT_SECRET || '비밀열쇠12345678');
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  }, 60000);

  beforeEach(async () => {
    await User.deleteMany({});

    await User.create({
      id: 'test-user',
      name: 'Test User',
      affiliation: 'Test Org',
      position: '센터장',
      password: 'testpassword',
      isPending: false,
      isAdmin: true,
      roleLevel: 1
    });
  }, 10000);

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          id: 'new-user',
          name: 'New User',
          affiliation: 'New Org',
          position: '센터장',
          password: 'newpassword',
          passwordConfirm: 'newpassword'
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Registration successful, pending admin approval');

      const user = await User.findOne({ id: 'new-user' });
      expect(user).toBeTruthy();
      expect(user.isPending).toBe(true);
      expect(user.isAdmin).toBe(true);
      expect(user.roleLevel).toBe(1);
    }, 10000);

    it('should fail to register if user already exists', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          id: 'test-user',
          name: 'Test User 2',
          affiliation: 'Test Org 2',
          position: '파트장',
          password: 'testpassword2',
          passwordConfirm: 'testpassword2'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('이미 존재하는 ID입니다.');
    }, 10000);
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          id: 'test-user',
          password: 'testpassword'
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
    }, 10000);

    it('should fail to login with incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          id: 'test-user',
          password: 'wrongpassword'
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('비밀번호가 일치하지 않습니다.');
    }, 10000);

    it('should fail to login if user does not exist', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          id: 'non-existent-user',
          password: 'testpassword'
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('등록되지 않은 사용자 혹은 아이디가 틀렸습니다.');
    }, 10000);
  });

  describe('POST /api/auth/check-id', () => {
    it('should return available true if ID is not taken', async () => {
      const res = await request(app)
        .post('/api/auth/check-id')
        .send({
          id: 'unique-user'
        });

      expect(res.status).toBe(200);
      expect(res.body.available).toBe(true);
    }, 10000);

    it('should return available false if ID is taken', async () => {
      const res = await request(app)
        .post('/api/auth/check-id')
        .send({
          id: 'test-user'
        });

      expect(res.status).toBe(200);
      expect(res.body.available).toBe(false);
    }, 10000);
  });

  describe('GET /api/auth/me', () => {
    it('should return user data with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({
        id: 'test-user',
        name: 'Test User',
        affiliation: 'Test Org',
        isPending: false,
        isAdmin: true
      });
    }, 10000);

    it('should fail if no token provided', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('No token provided');
    }, 10000);

    it('should fail if user not found', async () => {
      const invalidToken = jwt.sign({ id: 'non-existent-user' }, process.env.JWT_SECRET || '비밀열쇠12345678');
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('User not found');
    }, 10000);
  });
});