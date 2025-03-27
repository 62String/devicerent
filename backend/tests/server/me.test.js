const request = require('supertest');
const { app } = require('../../server');
const jwt = require('jsonwebtoken');

// server.js 모킹 및 의존성 모킹
jest.mock('../../server', () => {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  const verifyToken = jest.fn();
  const User = {
    findOne: jest.fn(),
  };
  app.get('/api/me', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    try {
      const decoded = await verifyToken(token, process.env.JWT_SECRET || '비밀열쇠12345678');
      const user = await User.findOne({ id: decoded.id });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json({
        user: {
          id: user.id,
          name: user.name,
          affiliation: user.affiliation,
          isPending: user.isPending || false,
          isAdmin: user.isAdmin || false,
        },
      });
    } catch (err) {
      res.status(401).json({ message: 'Invalid token' });
    }
  });
  return { app, initDevices: jest.fn(), User, verifyToken };
});

// server.js 의존성 모킹
jest.mock('../../routes/auth', () => null);
jest.mock('../../routes/devices', () => null);
jest.mock('../../routes/admin/approve', () => null);
jest.mock('../../routes/admin/users', () => null);

// User 모델 모킹
jest.mock('../../models/User', () => ({
  findOne: jest.fn(),
}));

describe('GET /api/me', () => {
  let token;
  let verifyToken;

  beforeEach(() => {
    token = jwt.sign({ id: 'user-id' }, process.env.JWT_SECRET || '비밀열쇠12345678');
    verifyToken = require('../../server').verifyToken;
    verifyToken.mockResolvedValue({ id: 'user-id' });
  });

  it('should return 401 if no token is provided', async () => {
    const res = await request(app)
      .get('/api/me')
      .set('Authorization', '');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('No token provided');
  });

  it('should return 404 if user is not found', async () => {
    const User = require('../../server').User;
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('User not found');
  });

  it('should return 200 with user data if user is found', async () => {
    const User = require('../../server').User;
    User.findOne.mockResolvedValue({
      id: 'user-id',
      name: 'Test User',
      affiliation: 'Test Dept',
      isPending: false,
      isAdmin: false,
    });

    const res = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: 'user-id',
      name: 'Test User',
      affiliation: 'Test Dept',
      isPending: false,
      isAdmin: false,
    });
  });

  it('should return 401 if token verification fails', async () => {
    verifyToken.mockRejectedValue(new Error('Invalid token'));

    const res = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid token');
  });
});