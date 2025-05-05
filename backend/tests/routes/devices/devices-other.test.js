const request = require('supertest');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const express = require('express');
const Device = require('../../../models/Device');
const User = require('../../../models/User');

// Express 앱 직접 생성 (테스트 환경에서 라우터 설정)
const app = express();
app.use(express.json());

// 라우터 설정 (server.js에서 하지 않으므로 테스트 코드에서 직접 설정)
const deviceRoutes = require('../../../routes/devices');
app.use('/api/devices', deviceRoutes);

// verifyToken 모킹 (비동기 함수로 설정)
jest.mock('../../../utils/auth', () => ({
  verifyToken: jest.fn().mockImplementation((token, secret) => {
    return Promise.resolve({ id: 'test-user', isAdmin: false }); // 비동기 함수로 Promise 반환
  }),
}));

let mongoServer;

beforeAll(async () => {
  // MongoMemoryServer 인스턴스 생성
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // DB 연결 상태 확인
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection failed');
  }
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongoServer.stop();
  // 비동기 리소스 정리 확인
  await new Promise(resolve => setTimeout(resolve, 1000));
});

beforeEach(async () => {
  // 테스트 데이터베이스 초기화
  await mongoose.connection.db.dropDatabase();

  // User 데이터 직접 삽입
  const userCollection = mongoose.connection.db.collection('users');
  await userCollection.insertOne({
    id: 'test-user',
    name: 'Test User',
    affiliation: 'Test Org',
    position: '연구원',
    password: 'testpassword',
    isPending: false,
    isAdmin: false,
  });

  // User 생성 확인
  const createdUser = await userCollection.findOne({ id: 'test-user' });
  if (!createdUser) {
    throw new Error('User creation failed in collection');
  }

  // Device 데이터 직접 삽입
  const deviceCollection = mongoose.connection.db.collection('devices');
  await deviceCollection.insertOne({
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

  // Device 생성 확인
  const createdDevice = await deviceCollection.findOne({ serialNumber: 'TEST001' });
  if (!createdDevice) {
    throw new Error('Device creation failed in collection');
  }

  // DB 반영 대기
  await mongoose.connection.db.command({ ping: 1 }); // DB 연결 상태 확인
  await new Promise(resolve => setTimeout(resolve, 3000)); // 추가 대기 시간
});

describe('Devices API - Other Tests (PATCH and DELETE /api/devices)', () => {
  let userToken;

  beforeAll(() => {
    userToken = jwt.sign({ id: 'test-user', isAdmin: false }, '비밀열쇠12345678', { expiresIn: '1h' });
  });

  describe('PATCH /api/devices', () => {
    it('should update device status successfully', async () => {
      const res = await request(app)
        .patch('/api/devices')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001', status: 'inactive' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Device updated successfully');
      const device = await Device.findOne({ serialNumber: 'TEST001' });
      expect(device.status).toBe('inactive');
    });

    it('should return 401 if no token provided', async () => {
      const res = await request(app)
        .patch('/api/devices')
        .send({ deviceId: 'TEST001', status: 'inactive' });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('No token provided');
    });

    it('should return 404 if device not found', async () => {
      const res = await request(app)
        .patch('/api/devices')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'INVALID', status: 'inactive' });
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Device not found');
    });
  });

  describe('DELETE /api/devices', () => {
    it('should delete device successfully', async () => {
      const res = await request(app)
        .delete('/api/devices')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Device deleted successfully');
      const device = await Device.findOne({ serialNumber: 'TEST001' });
      expect(device).toBeNull();
    });

    it('should return 401 if no token provided', async () => {
      const res = await request(app)
        .delete('/api/devices')
        .send({ deviceId: 'TEST001' });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('No token provided');
    });

    it('should return 404 if device not found', async () => {
      const res = await request(app)
        .delete('/api/devices')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'INVALID' });
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Device not found');
    });
  });
});