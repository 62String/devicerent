const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const express = require('express');
const Device = require('../../../models/Device');

const app = express();
app.use(express.json());
const deviceRoutes = require('../../../routes/devices');
app.use('/api/devices', deviceRoutes);

// 토큰 → 역할 매핑: 팀장(roleLevel 3), 파트장(4), 연구원(5)
jest.mock('../../../utils/auth', () => ({
  verifyToken: jest.fn().mockImplementation((token) => {
    if (token === 'team') return Promise.resolve({ id: 'team-id' });
    if (token === 'part') return Promise.resolve({ id: 'part-id' });
    if (token === 'researcher') return Promise.resolve({ id: 'res-id' });
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
  await users.insertOne({ id: 'team-id', name: '팀장님', affiliation: 'QA', position: '팀장', password: 'x', isPending: false, isAdmin: true, roleLevel: 3 });
  await users.insertOne({ id: 'part-id', name: '파트장님', affiliation: 'QA', position: '파트장', password: 'x', isPending: false, isAdmin: true, roleLevel: 4 });
  await users.insertOne({ id: 'res-id', name: '연구원', affiliation: 'QA', position: '연구원', password: 'x', isPending: false, isAdmin: false, roleLevel: 5 });

  const now = Date.now();
  await Device.create([
    { serialNumber: 'PND01', deviceInfo: 'Galaxy', osName: 'Android', osVersion: '14', modelName: 'Galaxy Tab', status: 'active',
      rentedBy: { name: '한지민', affiliation: 'QA 3팀' }, rentalType: 'longterm', longTermStatus: 'pending', remark: '출장 검수', rentedAt: new Date(now - 100 * HOUR) },
    { serialNumber: 'NRM01', deviceInfo: 'iPhone', osName: 'iOS', osVersion: '18', modelName: 'iPhone 15', status: 'active',
      rentedBy: { name: '유기현', affiliation: 'QA 2팀' }, rentalType: 'normal', longTermStatus: 'none', rentedAt: new Date(now - 1 * HOUR) },
    { serialNumber: 'STALE01', deviceInfo: 'Pixel', osName: 'Android', osVersion: '15', modelName: 'Pixel 9', status: 'active',
      rentedBy: null, rentalType: 'longterm', longTermStatus: 'pending', rentedAt: null },
  ]);
});

describe('장기대여 승인 워크플로우 (팀장 이상 전용)', () => {
  describe('GET /api/devices/longterm/pending', () => {
    it('토큰 없으면 401', async () => {
      const res = await request(app).get('/api/devices/longterm/pending');
      expect(res.status).toBe(401);
    });

    it('파트장(roleLevel 4)이면 403 — 팀장 이상만', async () => {
      const res = await request(app).get('/api/devices/longterm/pending').set('Authorization', 'Bearer part');
      expect(res.status).toBe(403);
      expect(res.body.message).toContain('팀장 이상');
    });

    it('연구원이면 403', async () => {
      const res = await request(app).get('/api/devices/longterm/pending').set('Authorization', 'Bearer researcher');
      expect(res.status).toBe(403);
    });

    it('팀장이면 200 + 승인 대기 목록(미승인 장기대여만)', async () => {
      const res = await request(app).get('/api/devices/longterm/pending').set('Authorization', 'Bearer team');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].serialNumber).toBe('PND01');
      expect(res.body[0].renterName).toBe('한지민');
      expect(res.body[0].overdue).toBe(true); // 100h > 72h
    });
  });

  describe('POST /api/devices/longterm/approve', () => {
    it('팀장이 승인하면 approved + 승인자 기록', async () => {
      const res = await request(app).post('/api/devices/longterm/approve').set('Authorization', 'Bearer team').send({ serialNumber: 'PND01' });
      expect(res.status).toBe(200);
      const device = await Device.findOne({ serialNumber: 'PND01' });
      expect(device.longTermStatus).toBe('approved');
      expect(device.approvedBy).toBe('팀장님');
      expect(device.approvedAt).toBeTruthy();
    });

    it('파트장이 승인 시도하면 403', async () => {
      const res = await request(app).post('/api/devices/longterm/approve').set('Authorization', 'Bearer part').send({ serialNumber: 'PND01' });
      expect(res.status).toBe(403);
      const device = await Device.findOne({ serialNumber: 'PND01' });
      expect(device.longTermStatus).toBe('pending'); // 변경 안 됨
    });

    it('대기 건이 아니면 404', async () => {
      const res = await request(app).post('/api/devices/longterm/approve').set('Authorization', 'Bearer team').send({ serialNumber: 'NRM01' });
      expect(res.status).toBe(404);
    });

    it('이미 반납된 pending 찌꺼기는 승인하지 않는다', async () => {
      const res = await request(app).post('/api/devices/longterm/approve').set('Authorization', 'Bearer team').send({ serialNumber: 'STALE01' });
      expect(res.status).toBe(409);
      const device = await Device.findOne({ serialNumber: 'STALE01' });
      expect(device.longTermStatus).toBe('pending');
      expect(device.approvedAt).toBeFalsy();
    });
  });

  describe('POST /api/devices/longterm/reject', () => {
    it('거절하면 일반대여로 환원', async () => {
      const res = await request(app).post('/api/devices/longterm/reject').set('Authorization', 'Bearer team').send({ serialNumber: 'PND01' });
      expect(res.status).toBe(200);
      const device = await Device.findOne({ serialNumber: 'PND01' });
      expect(device.rentalType).toBe('normal');
      expect(device.longTermStatus).toBe('none');
    });

    it('이미 반납된 pending 찌꺼기는 승인 대기에서 해제한다', async () => {
      const res = await request(app).post('/api/devices/longterm/reject').set('Authorization', 'Bearer team').send({ serialNumber: 'STALE01' });
      expect(res.status).toBe(200);
      const device = await Device.findOne({ serialNumber: 'STALE01' });
      expect(device.rentalType).toBe('normal');
      expect(device.longTermStatus).toBe('none');
      expect(device.rentedBy).toBeNull();
    });
  });
});
