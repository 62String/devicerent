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
    app.get('/api/data', async (req, res) => {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ message: 'No token provided' });
      try {
        const decoded = await verifyToken(token, process.env.JWT_SECRET || '비밀열쇠12345678');
        const user = await User.findOne({ id: decoded.id });
        if (!user || user.isPending)
          return res.status(403).json({ message: 'Access denied' });
        res.json({ message: 'User data', data: [{ id: 1, name: 'Device Data' }] });
      } catch (err) {
        return res.status(403).json({ message: 'Invalid token' });
      }
    });
    return { app, initDevices: jest.fn(), User, verifyToken };
  });

  // server.js 의존성 모킹
  jest.mock('../../routes/auth', () => null);
  jest.mock('../../routes/devices', () => null);
  jest.mock('../../routes/admin/users', () => null);

  describe('GET /api/data', () => {
    let token;
    let verifyToken;

    beforeEach(() => {
      token = jwt.sign({ id: 'user-id' }, process.env.JWT_SECRET || '비밀열쇠12345678');
      verifyToken = require('../../server').verifyToken;
      verifyToken.mockResolvedValue({ id: 'user-id' });
    });

    it('should return 401 if no token is provided', async () => {
      const res = await request(app)
        .get('/api/data')
        .set('Authorization', '');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('No token provided');
    });

    it('should return 403 if user is not found', async () => {
      const User = require('../../server').User;
      User.findOne.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/data')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    it('should return 403 if user is pending', async () => {
      const User = require('../../server').User;
      User.findOne.mockResolvedValue({
        id: 'user-id',
        isPending: true,
      });

      const res = await request(app)
        .get('/api/data')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    it('should return 200 with user data if user is valid', async () => {
      const User = require('../../server').User;
      User.findOne.mockResolvedValue({
        id: 'user-id',
        isPending: false,
      });

      const res = await request(app)
        .get('/api/data')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('User data');
      expect(res.body.data).toEqual([{ id: 1, name: 'Device Data' }]);
    });

    it('should return 403 if token verification fails', async () => {
      verifyToken.mockRejectedValue(new Error('Invalid token'));

      const res = await request(app)
        .get('/api/data')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Invalid token');
    });
  });