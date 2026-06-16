const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const express = require('express');
const Device = require('../../../models/Device');
const RentalHistory = require('../../../models/RentalHistory');

const app = express();
app.use(express.json());
const deviceRoutes = require('../../../routes/devices');
app.use('/api/devices', deviceRoutes);

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
  await users.insertOne({ id: 'admin-id', name: 'Admin', affiliation: 'QA', position: '팀장', password: 'x', isPending: false, isAdmin: true, roleLevel: 3 });
  await users.insertOne({ id: 'user-id', name: 'User', affiliation: 'QA', position: '연구원', password: 'x', isPending: false, isAdmin: false, roleLevel: 5 });

  const now = Date.now();
  await Device.create([
    // 대여 가능 (active, 미대여) — Android 1, iOS 1
    { serialNumber: 'AVA01', deviceInfo: 'Galaxy', osName: 'Android', osVersion: '14', modelName: 'Galaxy S24', status: 'active' },
    { serialNumber: 'AVA02', deviceInfo: 'iPhone', osName: 'iOS', osVersion: '18', modelName: 'iPhone 15', status: 'active' },
    // 일반대여 5일 → 회수 대상(overdue)
    { serialNumber: 'OVD01', deviceInfo: 'Galaxy', osName: 'Android', osVersion: '13', modelName: 'Galaxy Z', status: 'active',
      rentedBy: { name: '김철수', affiliation: 'QA 1팀' }, rentalType: 'normal', longTermStatus: 'none', rentedAt: new Date(now - 120 * HOUR) },
    // 일반대여 2시간 → 정상
    { serialNumber: 'RNT02', deviceInfo: 'iPad', osName: 'iOS', osVersion: '17', modelName: 'iPad Pro', status: 'active',
      rentedBy: { name: '유기현', affiliation: 'QA 2팀' }, rentalType: 'normal', longTermStatus: 'none', rentedAt: new Date(now - 2 * HOUR) },
    // 승인된 장기대여 10일 → 회수 대상 아님(approved 제외)
    { serialNumber: 'LNG01', deviceInfo: 'Galaxy', osName: 'Android', osVersion: '14', modelName: 'Galaxy Tab', status: 'active',
      rentedBy: { name: '정승아', affiliation: '개발 1팀' }, rentalType: 'longterm', longTermStatus: 'approved', approvedBy: '박형진', rentedAt: new Date(now - 240 * HOUR) },
    // 미승인 장기대여 100시간(>72) → 회수 대상(overdue)에 포함
    { serialNumber: 'PND01', deviceInfo: 'Galaxy', osName: 'Android', osVersion: '13', modelName: 'Galaxy Note', status: 'active',
      rentedBy: { name: '한지민', affiliation: 'QA 3팀' }, rentalType: 'longterm', longTermStatus: 'pending', rentedAt: new Date(now - 100 * HOUR) },
    // 수리중
    { serialNumber: 'REP01', deviceInfo: 'Galaxy', osName: 'Android', osVersion: '12', modelName: 'Galaxy A', status: 'repair' },
  ]);

  await RentalHistory.create([
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

  it('관리자면 200 + 집계 정확 (승인/미승인 장기대여 구분)', async () => {
    const res = await request(app).get('/api/devices/dashboard').set('Authorization', 'Bearer admin-token');
    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({
      total: 7,
      available: 2,
      rented: 4,
      longtermApproved: 1,   // LNG01
      pendingApproval: 1,    // PND01
      maintenance: 1,        // REP01
      overdue: 2,            // OVD01(일반 120h) + PND01(미승인 장기 100h). LNG01(승인) 제외
    });
    expect(res.body.osDistribution).toEqual({ Android: 5, iOS: 2 });
    expect(res.body.statusDistribution).toEqual({ active: 6, repair: 1, inactive: 0 });
  });

  it('승인된 장기대여는 경과시간이 길어도 회수 대상 아님 / 미승인 장기대여는 포함', async () => {
    const res = await request(app).get('/api/devices/dashboard').set('Authorization', 'Bearer admin-token');
    const byId = Object.fromEntries(res.body.rentedDevices.map((d) => [d.serialNumber, d]));

    expect(byId.LNG01.longTermStatus).toBe('approved');
    expect(byId.LNG01.overdue).toBe(false); // 승인 → 제외
    expect(byId.LNG01.approvedBy).toBe('박형진');

    expect(byId.PND01.longTermStatus).toBe('pending');
    expect(byId.PND01.overdue).toBe(true); // 미승인 + 72h+ → 회수 대상

    expect(byId.OVD01.overdue).toBe(true);
    expect(byId.RNT02.overdue).toBe(false);

    // 회수 대상(overdue)만 필터 → OVD01, PND01
    const overdue = res.body.rentedDevices.filter((d) => d.overdue).map((d) => d.serialNumber).sort();
    expect(overdue).toEqual(['OVD01', 'PND01']);
  });
});
