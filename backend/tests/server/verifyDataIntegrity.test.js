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

describe('GET /api/admin/verify-data-integrity', () => {
  let token;

  beforeAll(async () => {
    token = jwt.sign({ id: 'admin-id' }, process.env.JWT_SECRET || '비밀열쇠12345678');
  });

  beforeEach(async () => {
    await Device.deleteMany();
    await User.deleteMany();
  });

  afterEach(async () => {
    await Device.deleteMany();
    await User.deleteMany();
  });

  it('should detect data integrity issues', async () => {
    await Device.create({
      serialNumber: 'DEVICE_001',
      deviceInfo: 'Device Info 1',
      osName: 'AOS'
    });

    await Device.create({
      serialNumber: 'DEVICE_001',
      deviceInfo: 'Device Info 2',
      osName: 'AOS'
    });

    const user = await User.create({
      id: 'admin-id',
      isAdmin: true,
      position: '파트장',
      password: 'password123',
      affiliation: 'TestOrg',
      name: 'Admin User'
    });

    const res = await request(app)
      .get('/api/admin/verify-data-integrity')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Data integrity issues found');
    expect(res.body.issues).toHaveLength(1);
    expect(res.body.issues[0].issues).toContain('Duplicate serialNumber');
  });

  it('should pass data integrity check with valid data', async () => {
    await Device.create({
      serialNumber: 'TEST001',
      deviceInfo: 'Test Device Info',
      osName: 'AOS',
      osVersion: '14',
      modelName: 'TestDevice',
      status: 'active'
    });

    const user = await User.create({
      id: 'admin-id',
      isAdmin: true,
      position: '파트장',
      password: 'password123',
      affiliation: 'TestOrg',
      name: 'Admin User'
    });

    const res = await request(app)
      .get('/api/admin/verify-data-integrity')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Data integrity check passed, no issues found');
  });

  it('should hash password and set roleLevel correctly on user creation', async () => {
    const user = await User.create({
      id: 'test-user',
      name: 'Test User',
      affiliation: 'Test Org',
      position: '센터장',
      password: 'testpassword',
      isPending: true,
      isAdmin: false
    });

    // 비밀번호 해싱 테스트 (pre('save') 훅 - isModified('password') true 케이스)
    expect(await user.comparePassword('testpassword')).toBe(true);
    expect(await user.comparePassword('wrongpassword')).toBe(false);

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
  });
});