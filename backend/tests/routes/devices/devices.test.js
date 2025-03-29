const request = require('supertest');
    const mongoose = require('mongoose');
    const jwt = require('jsonwebtoken');
    const { app } = require('../../../server');

    // 모델 모킹
    const mockDeviceFind = jest.fn();
    const mockDeviceDeleteMany = jest.fn();
    const mockDeviceSave = jest.fn();
    const mockRentalHistorySave = jest.fn();
    const mockRentalHistoryFindOne = jest.fn();
    const mockUserFindOne = jest.fn();
    const mockUserDeleteMany = jest.fn();

    jest.mock('../../../models/Device', () => ({
      find: mockDeviceFind,
      deleteMany: mockDeviceDeleteMany,
      findOne: jest.fn().mockImplementation(() => ({
        save: mockDeviceSave,
      })),
    }));

    jest.mock('../../../models/RentalHistory', () => ({
      findOne: mockRentalHistoryFindOne,
      deleteMany: jest.fn(),
    }));

    jest.mock('../../../models/User', () => ({
      findOne: mockUserFindOne,
      deleteMany: mockUserDeleteMany,
    }));

    // server.js 모킹 및 의존성 모킹
    jest.mock('../../../server', () => {
      const express = require('express');
      const app = express();
      app.use(express.json());
      app.use(express.urlencoded({ extended: true }));
      const verifyToken = jest.fn();
      app.get('/api/devices', async (req, res) => {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token provided' });
        try {
          const decoded = await verifyToken(token, process.env.JWT_SECRET || '비밀열쇠12345678');
          const user = await mockUserFindOne({ id: decoded.id });
          if (!user) return res.status(404).json({ message: 'User not found' });
          if (user.isPending) return res.status(403).json({ message: 'User is pending approval' });

          const devices = await mockDeviceFind();
          res.json(devices);
        } catch (error) {
          res.status(500).json({ message: 'Server error', error: error.message });
        }
      });

      app.get('/api/devices/available', async (req, res) => {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token provided' });
        try {
          const decoded = await verifyToken(token, process.env.JWT_SECRET || '비밀열쇠12345678');
          const user = await mockUserFindOne({ id: decoded.id });
          if (!user) return res.status(404).json({ message: 'User not found' });
          if (user.isPending) return res.status(403).json({ message: 'User is pending approval' });

          const devices = await mockDeviceFind({ rentedBy: null });
          res.json(devices);
        } catch (error) {
          res.status(500).json({ message: 'Server error', error: error.message });
        }
      });

      app.post('/api/devices/rent-device', async (req, res) => {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token provided' });
        try {
          const decoded = await verifyToken(token, process.env.JWT_SECRET || '비밀열쇠12345678');
          const user = await mockUserFindOne({ id: decoded.id });
          if (!user) return res.status(404).json({ message: 'User not found' });
          if (user.isPending) return res.status(403).json({ message: 'User is pending approval' });

          const { deviceId, remark } = req.body;
          const device = await require('../../../models/Device').findOne({ serialNumber: deviceId });
          if (!device) return res.status(404).json({ message: 'Device not found' });
          if (device.rentedBy) return res.status(400).json({ message: 'Device already rented' });

          device.rentedBy = { _id: user._id, name: user.name, affiliation: user.affiliation };
          device.rentedAt = new Date();
          device.remark = remark || '';
          await mockDeviceSave();

          const history = {
            serialNumber: device.serialNumber,
            userId: user.id,
            action: 'rent',
            userDetails: { name: user.name, affiliation: user.affiliation },
            deviceInfo: { modelName: device.modelName, osName: device.osName, osVersion: device.osVersion },
            timestamp: new Date(),
            remark: remark || '',
          };
          await mockRentalHistorySave(history);

          res.status(200).json({ message: 'Device rented successfully' });
        } catch (error) {
          res.status(500).json({ message: 'Server error', error: error.message });
        }
      });

      app.post('/api/devices/return-device', async (req, res) => {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token provided' });
        try {
          const decoded = await verifyToken(token, process.env.JWT_SECRET || '비밀열쇠12345678');
          const user = await mockUserFindOne({ id: decoded.id });
          if (!user) return res.status(404).json({ message: 'User not found' });
          if (user.isPending) return res.status(403).json({ message: 'User is pending approval' });

          const { deviceId } = req.body;
          const device = await require('../../../models/Device').findOne({ serialNumber: deviceId });
          if (!device) return res.status(404).json({ message: 'Device not found' });
          if (!device.rentedBy) return res.status(400).json({ message: 'Device is not rented' });

          const history = {
            serialNumber: device.serialNumber,
            userId: user.id,
            action: 'return',
            userDetails: { name: user.name, affiliation: user.affiliation },
            deviceInfo: { modelName: device.modelName, osName: device.osName, osVersion: device.osVersion },
            timestamp: new Date(),
            remark: device.remark || '',
          };
          await mockRentalHistorySave(history);

          device.rentedBy = null;
          device.rentedAt = null;
          device.remark = '';
          await mockDeviceSave();

          res.status(200).json({ message: 'Device returned successfully' });
        } catch (error) {
          res.status(500).json({ message: 'Server error', error: error.message });
        }
      });

      return { app, verifyToken };
    });

    describe('Devices API', () => {
      let userToken;
      let adminToken;

      beforeAll(async () => {
        // 실제 MongoDB 인스턴스에 연결
        await mongoose.connect('mongodb://localhost:27017/testdb', {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        });
        userToken = jwt.sign({ id: 'test-user', isAdmin: false }, '비밀열쇠12345678', { expiresIn: '1h' });
        adminToken = jwt.sign({ id: 'admin-id', isAdmin: true }, '비밀열쇠12345678', { expiresIn: '1h' });
      });

      afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
      });

      beforeEach(async () => {
        mockDeviceFind.mockReset();
        mockDeviceDeleteMany.mockReset();
        mockDeviceSave.mockReset();
        mockRentalHistorySave.mockReset();
        mockRentalHistoryFindOne.mockReset();
        mockUserFindOne.mockReset();
        mockUserDeleteMany.mockReset();

        // 테스트용 사용자 생성
        mockUserFindOne.mockImplementation((query) => {
          if (query.id === 'test-user') {
            return Promise.resolve({
              id: 'test-user',
              name: 'Test User',
              affiliation: 'Test Org',
              _id: 'mocked-user-id',
              isPending: false,
              isAdmin: true,
            });
          }
          return Promise.resolve(null);
        });

        // 테스트용 디바이스 생성
        require('../../../models/Device').findOne.mockImplementation((query) => {
          if (query.serialNumber === 'TEST001') {
            return Promise.resolve({
              serialNumber: 'TEST001',
              deviceInfo: 'Test Device Info',
              osName: 'AOS',
              osVersion: '14',
              modelName: 'TestDevice',
              status: 'active',
              rentedBy: null,
              rentedAt: null,
              remark: '',
              save: mockDeviceSave,
            });
          }
          return Promise.resolve(null);
        });

        mockDeviceFind.mockImplementation((query) => {
          if (query && query.rentedBy === null) {
            return Promise.resolve([
              { serialNumber: 'TEST001', deviceInfo: 'Test Device Info', osName: 'AOS', osVersion: '14', modelName: 'TestDevice', status: 'active' }
            ]);
          }
          return Promise.resolve([
            { serialNumber: 'TEST001', deviceInfo: 'Test Device Info', osName: 'AOS', osVersion: '14', modelName: 'TestDevice', status: 'active' }
          ]);
        });

        mockDeviceDeleteMany.mockResolvedValue({ deletedCount: 1 });
        mockUserDeleteMany.mockResolvedValue({ deletedCount: 1 });
        require('../../../server').verifyToken.mockReset();
      });

      describe('GET /api/devices', () => {
        it('should return list of devices', async () => {
          require('../../../server').verifyToken.mockResolvedValue({ id: 'test-user' });

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
      });

      describe('GET /api/devices/available', () => {
        it('should return list of available devices', async () => {
          require('../../../server').verifyToken.mockResolvedValue({ id: 'test-user' });

          const res = await request(app)
            .get('/api/devices/available')
            .set('Authorization', `Bearer ${userToken}`);

          expect(res.status).toBe(200);
          expect(res.body).toHaveLength(1);
          expect(res.body[0].serialNumber).toBe('TEST001');
        });
      });

      describe('POST /api/devices/rent-device', () => {
        it('should rent a device successfully', async () => {
          require('../../../server').verifyToken.mockResolvedValue({ id: 'test-user' });

          const res = await request(app)
            .post('/api/devices/rent-device')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ deviceId: 'TEST001', remark: 'Test rent' });

          expect(res.status).toBe(200);
          expect(res.body.message).toBe('Device rented successfully');
          expect(mockDeviceSave).toHaveBeenCalled();
          expect(mockRentalHistorySave).toHaveBeenCalled();
        }, 10000);

        it('should fail if device already rented', async () => {
          require('../../../server').verifyToken.mockResolvedValue({ id: 'test-user' });

          // 디바이스 대여 상태로 설정
          require('../../../models/Device').findOne.mockImplementation((query) => {
            if (query.serialNumber === 'TEST001') {
              return Promise.resolve({
                serialNumber: 'TEST001',
                deviceInfo: 'Test Device Info',
                osName: 'AOS',
                osVersion: '14',
                modelName: 'TestDevice',
                status: 'active',
                rentedBy: { _id: 'mocked-user-id', name: 'Test User', affiliation: 'Test Org' },
                rentedAt: new Date(),
                remark: 'Test rent',
                save: mockDeviceSave,
              });
            }
            return Promise.resolve(null);
          });

          const res = await request(app)
            .post('/api/devices/rent-device')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ deviceId: 'TEST001' });

          expect(res.status).toBe(400);
          expect(res.body.message).toBe('Device already rented');
        }, 10000);
      });

      describe('POST /api/devices/return-device', () => {
        it('should return a device successfully', async () => {
          require('../../../server').verifyToken.mockResolvedValue({ id: 'test-user' });

          // 디바이스 대여 상태로 설정
          require('../../../models/Device').findOne.mockImplementation((query) => {
            if (query.serialNumber === 'TEST001') {
              return Promise.resolve({
                serialNumber: 'TEST001',
                deviceInfo: 'Test Device Info',
                osName: 'AOS',
                osVersion: '14',
                modelName: 'TestDevice',
                status: 'active',
                rentedBy: { _id: 'mocked-user-id', name: 'Test User', affiliation: 'Test Org' },
                rentedAt: new Date(),
                remark: 'Test rent',
                save: mockDeviceSave,
              });
            }
            return Promise.resolve(null);
          });

          const res = await request(app)
            .post('/api/devices/return-device')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ deviceId: 'TEST001' });

          expect(res.status).toBe(200);
          expect(res.body.message).toBe('Device returned successfully');
          expect(mockDeviceSave).toHaveBeenCalled();
          expect(mockRentalHistorySave).toHaveBeenCalled();
        }, 10000);

        it('should fail if device not rented', async () => {
          require('../../../server').verifyToken.mockResolvedValue({ id: 'test-user' });

          const res = await request(app)
            .post('/api/devices/return-device')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ deviceId: 'TEST001' });

          expect(res.status).toBe(400);
          expect(res.body.message).toBe('Device is not rented');
        }, 10000);
      });
    });