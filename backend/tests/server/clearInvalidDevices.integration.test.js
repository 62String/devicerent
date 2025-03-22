const request = require('supertest');
const app = require('../../server');
const Device = require('../../models/Device');
const User = require('../../models/User');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');

describe('POST /api/admin/clear-invalid-devices (Integration)', () => {
  let token;
  let testConnection;

  beforeAll(async () => {
    testConnection = mongoose.createConnection('mongodb://localhost:27017/devicerent-test', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 60000
    });
    const DeviceModel = testConnection.model('Device', Device.schema);
    const UserModel = testConnection.model('User', User.schema);
    await Promise.all([
      DeviceModel.deleteMany({}),
      UserModel.deleteMany({})
    ]);
    token = jwt.sign({ id: 'admin-id' }, process.env.JWT_SECRET || '비밀열쇠12345678');
    await UserModel.create({
      id: 'admin-id',
      name: 'Admin User',
      affiliation: 'Admin Dept',
      position: '센터장',
      password: 'password123',
      isAdmin: true
    });
  }, 60000);

  afterAll(async () => {
    await testConnection.dropDatabase();
    await testConnection.close();
  });

  afterEach(async () => {
    const DeviceModel = testConnection.model('Device', Device.schema);
    const UserModel = testConnection.model('User', User.schema);
    await Promise.all([
      DeviceModel.deleteMany({ serialNumber: { $in: ['TEST001'] } }),
      UserModel.deleteMany({ id: 'admin-id' })
    ]);
  });

  it('should clear invalid devices and re-sync', async () => {
    const DeviceModel = testConnection.model('Device', Device.schema);
    await DeviceModel.create({
      osName: 'AOS'
    });

    const exportPath = path.join(__dirname, 'test.xlsx');
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet([
      { '시리얼 번호': 'TEST001', 'OS 이름': 'AOS', 'OS 버전': '14', '모델명': 'TestDevice' }
    ]);
    xlsx.utils.book_append_sheet(wb, ws, 'Devices');
    xlsx.writeFile(wb, exportPath);

    const res = await request(app)
      .post('/api/admin/clear-invalid-devices')
      .set('Authorization', `Bearer ${token}`)
      .send({ exportPath });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Invalid devices cleared and re-synced successfully');

    const devices = await DeviceModel.find();
    expect(devices.length).toBe(1);
    expect(devices[0].serialNumber).toBe('TEST001');

    fs.unlinkSync(exportPath);
  });
});