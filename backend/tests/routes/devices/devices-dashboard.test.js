const request = require('supertest');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const express = require('express');
const Device = require('../../../models/Device');
const RentalHistory = require('../../../models/RentalHistory');

const app = express();
app.use(express.json());
const deviceRoutes = require('../../../routes/devices');
app.use('/api/devices', deviceRoutes);

// adminAuth는 verifyToken → User.findOne(isAdmin) 순으로 검사한다.
// 토큰 문자열로 admin / non-admin을 구분하도록 모킹.
jest.mock('../../../utils/auth', () => ({
  verifyToken: jest.fn().mockImplementation((token) => {
    if (token === 'admin-token') return Promise.resolve({ id: 'admin-id', isAdmin: true });
    if (token === 'user-token') return Promise.resolve({ id: 'user-id', isAdmin: false });
    return Promise.reject(new Error('Invalid token'));
  }),
}));

let mongoServer;
const HOUR = 1000 * 60 * 60;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongoServer.stop();
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  const users = mongoose.connection.db.collection('users');
  await users.insertOne({ id: 'admin-id', name: 'Admin', affiliation: 'QA', position: '팀장', password: 'x', isPending: false, isAdmin: true });
  await users.insertOne({ id: 'user-id', name: 'User', affiliation: 'QA', position: '연구원', password: 'x', isPending: false, isAdmin: false });

  const now = Date.now();
  await Device.create([
    // 대여 가능 (active, 미대여) x2 — Android 1, iOS 1
    { serialNumber: 'AVA01', deviceInfo: 'Galaxy', osName: 'Android', osVersion: '14', modelName: 'Galaxy S24', status: 'active' },
    { serialNumber: 'AVA02', deviceInfo: 'iPhone', osName: 'iOS', osVersion: '18', modelName: 'iPhone 15', status: 'active' },
    // 대여중 — 장기 미반납(5일) Android
    { serialNumber: 'OVD01', deviceInfo: 'Galaxy', osName: 'Android', osVersion: '13', modelName: 'Galaxy Z', status: 'active',
      rentedBy: { name: '김철수', affiliation: 'QA 1팀' }, rentedAt: new Date(now - 120 * HOUR) },
    // 대여중 — 최근(2시간) iOS
    { serialNumber: 'RNT02', deviceInfo: 'iPad', osName: 'iOS', osVersion: '17', modelName: 'iPad Pro', status: 'active',
      rentedBy: { name: '유기현', affiliation: 'QA 2팀' }, rentedAt: new Date(now - 2 * HOUR) },
    // 수리중 Android (미대여)
    { serialNumber: 'REP01', deviceInfo: 'Galaxy', osName: 'Android', osVersion: '12', modelName: 'Galaxy A', status: 'repair' },
  ]);

  await RentalHistory.create([
    { deviceId: new mongoose.Types.ObjectId(), serialNumber: 'OVD01', userId: 'u1', action: 'rent', timestamp: new Date(now - 120 * HOUR),
      userDetails: { name: '김철수', affiliation: 'QA 1팀' }, deviceInfo: { modelName: 'Galaxy Z', osName: 'Android', osVersion: '13' } },
    { deviceId: new mongoose.Types.ObjectId(), serialNumber: 'RNT02', userId: 'u2', action: 'rent', timestamp: new Date(now - 2 * HOUR),
      userDetails: { name: '유기현', affiliation: 'QA 2팀' }, deviceInfo: { modelName: 'iPad Pro', osName: 'iOS', osVersion: '17' } },
  ]);
});

describe('GET /api/devices/dashboard', () => {
  it('토큰이 없으면 401', async () => {
    const res = await request(app).get('/api/devices/dashboard');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('토큰이 없습니다.');
  });

  it('비관리자(연구원)면 403', async () => {
    const res = await request(app).get('/api/devices/dashboard').set('Authorization', 'Bearer user-token');
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('관리자 권한이 필요합니다.');
  });

  it('관리자면 200 + 집계 형태 정확', async () => {
    const res = await request(app).get('/api/devices/dashboard').set('Authorization', 'Bearer admin-token');
    expect(res.status).toBe(200);

    expect(res.body.counts).toEqual({
      total: 5,
      available: 2,
      rented: 2,
      maintenance: 1,
      overdue: 1,
    });
    expect(res.body.osDistribution).toEqual({ Android: 3, iOS: 2 });
    expect(res.body.statusDistribution).toEqual({ active: 4, repair: 1, inactive: 0 });
    expect(res.body.overdueThresholdHours).toBe(72);
  });

  it('rentedDevices가 경과시간 내림차순 + elapsedHours/overdue 포함', async () => {
    const res = await request(app).get('/api/devices/dashboard').set('Authorization', 'Bearer admin-token');
    const rented = res.body.rentedDevices;
    expect(rented).toHaveLength(2);
    expect(rented[0].serialNumber).toBe('OVD01'); // 5일 — 먼저
    expect(rented[1].serialNumber).toBe('RNT02'); // 2시간
    expect(rented[0].elapsedHours).toBeGreaterThanOrEqual(72);
    expect(rented[0].overdue).toBe(true);
    expect(rented[1].overdue).toBe(false);
    expect(rented[0].renterName).toBe('김철수');
  });

  it('recentActivity가 최근순 + 최대 8건', async () => {
    const res = await request(app).get('/api/devices/dashboard').set('Authorization', 'Bearer admin-token');
    const acts = res.body.recentActivity;
    expect(acts.length).toBeLessThanOrEqual(8);
    expect(acts[0].serialNumber).toBe('RNT02'); // 가장 최근(2시간 전)
    expect(acts[0].action).toBe('rent');
    expect(acts[0].userName).toBe('유기현');
  });
});
