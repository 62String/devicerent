const request = require('supertest');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const Device = require('../../../models/Device');
const User = require('../../../models/User');
const RentalHistory = require('../../../models/RentalHistory');

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  await User.create({
    id: 'test-user',
    name: 'Test User',
    affiliation: 'Test Org',
    position: '연구원',
    password: 'testpassword',
    isPending: false,
    isAdmin: false,
  });
  await User.create({
    id: 'admin-id',
    name: 'Admin User',
    affiliation: 'Admin Org',
    position: '센터장',
    password: 'adminpassword',
    isPending: false,
    isAdmin: true,
  });

  app = require('../../../server').app;
  const deviceRoutes = require('../../../routes/devices');
  app.use('/api/devices', deviceRoutes);
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Device.deleteMany({});
  await Device.create({
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
  await RentalHistory.deleteMany({});
  await new Promise(resolve => setTimeout(resolve, 100));
});

describe('Devices API', () => {
  let userToken;
  let adminToken;
  let invalidToken;
  let expiredToken;

  beforeAll(() => {
    userToken = jwt.sign({ id: 'test-user', isAdmin: false }, '비밀열쇠12345678', { expiresIn: '1h' });
    adminToken = jwt.sign({ id: 'admin-id', isAdmin: true }, '비밀열쇠12345678', { expiresIn: '1h' });
    invalidToken = jwt.sign({ id: 'nonexistent-user', isAdmin: false }, 'wrongsecret', { expiresIn: '1h' });
    expiredToken = jwt.sign({ id: 'test-user', isAdmin: false }, '비밀열쇠12345678', { expiresIn: '0s' });
  });

  describe('GET /api/devices', () => {
    it('should return list of devices', async () => {
      const res = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].serialNumber).toBe('TEST001');
    });

    it('should return 401 if no token provided', async () => {
      const res = await request(app).get('/api/devices');
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('No token provided');
    });

    it('should return 401 if token is invalid', async () => {
      const res = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${invalidToken}`);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid token');
    });

    it('should return 404 if no devices', async () => {
      await Device.deleteMany({});
      const res = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('No devices found');
    });

    it('should handle database error', async () => {
      jest.spyOn(Device, 'find').mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      const res = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Server error');
    });
  });

  describe('GET /api/devices/available', () => {
    it('should return list of available devices', async () => {
      const res = await request(app)
        .get('/api/devices/available')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].serialNumber).toBe('TEST001');
    });

    it('should return 404 if no available devices', async () => {
      await Device.updateOne(
        { serialNumber: 'TEST001' },
        { rentedBy: { name: 'Test User', affiliation: 'Test Org' }, rentedAt: new Date() }
      );
      const res = await request(app)
        .get('/api/devices/available')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('No available devices found');
    });

    it('should return 404 if devices are inactive', async () => {
      await Device.updateOne(
        { serialNumber: 'TEST001' },
        { status: 'inactive' }
      );
      const res = await request(app)
        .get('/api/devices/available')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('No available devices found');
    });

    it('should return 500 if token is expired', async () => {
      const res = await request(app)
        .get('/api/devices/available')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Server error');
    });
  });

  describe('POST /api/devices/rent-device', () => {
    it('should rent a device successfully', async () => {
      const res = await request(app)
        .post('/api/devices/rent-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001', remark: 'Test rent' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Device rented successfully');
      const device = await Device.findOne({ serialNumber: 'TEST001' });
      expect(device.rentedBy.name).toBe('Test User');
      expect(device.remark).toBe('Test rent');
    });

    it('should fail if device already rented', async () => {
      await Device.updateOne(
        { serialNumber: 'TEST001' },
        { rentedBy: { name: 'Other User', affiliation: 'Other Org' }, rentedAt: new Date() }
      );
      const res = await request(app)
        .post('/api/devices/rent-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Device already rented');
    });

    it('should fail if device not active', async () => {
      await Device.updateOne(
        { serialNumber: 'TEST001' },
        { status: 'inactive' }
      );
      const res = await request(app)
        .post('/api/devices/rent-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Device is not available (inactive)');
    });

    it('should fail if deviceId is invalid', async () => {
      const res = await request(app)
        .post('/api/devices/rent-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'INVALID' });
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Device not found');
    });

    it('should handle Device database save error', async () => {
      jest.spyOn(Device, 'findOne').mockResolvedValueOnce({
        serialNumber: 'TEST001',
        rentedBy: null,
        status: 'active',
        modelName: 'TestDevice',
        osName: 'AOS',
        osVersion: '14',
      });
      jest.spyOn(Device, 'findOneAndUpdate').mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      const res = await request(app)
        .post('/api/devices/rent-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001', remark: 'Test rent' });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Server error');
    });

    it('should handle RentalHistory database save error', async () => {
      jest.spyOn(RentalHistory, 'create').mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app)
        .post('/api/devices/rent-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001', remark: 'Test rent' });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Server error');
    });
  });

  describe('POST /api/devices/return-device', () => {
    it('should return a device successfully', async () => {
      await Device.updateOne(
        { serialNumber: 'TEST001' },
        { rentedBy: { name: 'Test User', affiliation: 'Test Org' }, rentedAt: new Date(), remark: 'Test rent' }
      );
      const res = await request(app)
        .post('/api/devices/return-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Device returned successfully');
      const device = await Device.findOne({ serialNumber: 'TEST001' });
      expect(device.rentedBy).toBeNull();
      expect(device.rentedAt).toBeNull();
    });

    it('should fail if device not rented', async () => {
      const res = await request(app)
        .post('/api/devices/return-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Device is not rented');
    });

    it('should fail if user is not the renter', async () => {
      await Device.updateOne(
        { serialNumber: 'TEST001' },
        { rentedBy: { name: 'Other User', affiliation: 'Other Org' }, rentedAt: new Date() }
      );
      const res = await request(app)
        .post('/api/devices/return-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001' });
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Cannot return this device');
    });

    it('should fail if device does not exist', async () => {
      const res = await request(app)
        .post('/api/devices/return-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'INVALID' });
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Device not found');
    });

    it('should handle Device database error', async () => {
      await Device.updateOne(
        { serialNumber: 'TEST001' },
        { rentedBy: { name: 'Test User', affiliation: 'Test Org' }, rentedAt: new Date(), remark: 'Test rent' }
      );
      jest.spyOn(Device, 'findOne').mockResolvedValueOnce({
        serialNumber: 'TEST001',
        rentedBy: { name: 'Test User', affiliation: 'Test Org' },
        modelName: 'TestDevice',
        osName: 'AOS',
        osVersion: '14',
      });
      jest.spyOn(Device, 'findOneAndUpdate').mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      const res = await request(app)
        .post('/api/devices/return-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001' });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Server error');
    });

    it('should handle RentalHistory database error', async () => {
      await Device.updateOne(
        { serialNumber: 'TEST001' },
        { rentedBy: { name: 'Test User', affiliation: 'Test Org' }, rentedAt: new Date(), remark: 'Test rent' }
      );
      jest.spyOn(RentalHistory, 'create').mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app)
        .post('/api/devices/return-device')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ deviceId: 'TEST001' });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Server error');
    });
  });
});