/**
 * @description Tests for verify-data-integrity API endpoint in server.js
 * @module verifyDataIntegrity
 */
const request = require('supertest');
const app = require('../../server');
const Device = require('../../models/Device');
const User = require('../../models/User');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

describe('GET /api/admin/verify-data-integrity', () => {
  let token;

  beforeEach(async () => {
    await Device.deleteMany();
    await User.deleteMany();
    token = jwt.sign({ id: 'admin-id' }, process.env.JWT_SECRET || '비밀열쇠12345678');
    await User.create({ id: 'admin-id', isAdmin: true });
  });

  /**
   * @description Test case for detecting data integrity issues
   * @test {verifyDataIntegrity}
   */
  it('should detect data integrity issues', async () => {
    await Device.create({
      osName: 'AOS'
    });

    const res = await request(app)
      .get('/api/admin/verify-data-integrity')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Data integrity issues found');
    expect(res.body.issues).toHaveLength(1);
    expect(res.body.issues[0].issues).toContain('Missing serialNumber');
  });

  /**
   * @description Test case for passing data integrity check with valid data
   * @test {verifyDataIntegrity}
   */
  it('should pass data integrity check with valid data', async () => {
    await Device.create({
      serialNumber: 'TEST001',
      osName: 'AOS',
      osVersion: '14',
      modelName: 'TestDevice',
      status: 'active'
    });

    const res = await request(app)
      .get('/api/admin/verify-data-integrity')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Data integrity check passed, no issues found');
  });
});