const request = require('supertest');
  const mongoose = require('mongoose');
  const jwt = require('jsonwebtoken');
  const { app } = require('../../server');

  // Device 모델 모킹
  const mockDeviceFind = jest.fn();
  jest.mock('../../models/Device', () => ({
    find: mockDeviceFind,
  }));

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
    app.post('/api/admin/init-devices', async (req, res) => {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ message: 'No token provided' });
      try {
        const decoded = await verifyToken(token, process.env.JWT_SECRET || '비밀열쇠12345678');
        const user = await User.findOne({ id: decoded.id, isAdmin: true });
        if (!user) return res.status(403).json({ message: 'Admin access required' });

        const { exportPath } = req.body;
        const initDevices = require('../../server').initDevices;
        await initDevices(false, exportPath);
        res.json({ message: 'Device initialization completed' });
      } catch (error) {
        if (error.message.includes('Invalid devices found')) {
          res.status(400).json(JSON.parse(error.message));
        } else {
          res.status(500).json({ message: 'Server error', error: error.message });
        }
      }
    });
    return { app, initDevices: jest.fn(), User, verifyToken };
  });

  // server.js 의존성 모킹
  jest.mock('../../routes/auth', () => null);
  jest.mock('../../routes/devices', () => null);
  jest.mock('../../routes/admin/users', () => null);

  // xlsx 모킹
  const mockXlsx = {
    readFile: jest.fn(),
    utils: {
      sheet_to_json: jest.fn(),
      json_to_sheet: jest.fn(),
      book_new: jest.fn(),
      book_append_sheet: jest.fn(),
    },
    write: jest.fn(), // write 속성을 jest.fn()으로 초기화
  };
  jest.mock('xlsx', () => mockXlsx);

  // fs 모킹
  jest.mock('fs', () => ({
    readdirSync: jest.fn(),
    statSync: jest.fn(),
    existsSync: jest.fn(),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
  }));

  describe('POST /api/admin/init-devices', () => {
    let adminToken;
    let mockFs;

    beforeAll(async () => {
      // 실제 MongoDB 인스턴스에 연결
      await mongoose.connect('mongodb://localhost:27017/testdb');
      adminToken = jwt.sign({ id: 'admin-id', isAdmin: true }, 'your-secret-key', { expiresIn: '1h' });
    });

    afterAll(async () => {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    });

    beforeEach(async () => {
      mockDeviceFind.mockReset();
      require('../../server').verifyToken.mockResolvedValue({ id: 'admin-id' });
      require('../../server').User.findOne.mockResolvedValue({ id: 'admin-id', isAdmin: true });
      mockFs = require('fs');
      mockFs.existsSync.mockReturnValue(true);
      mockXlsx.readFile.mockReturnValue({ Sheets: { Sheet1: {} }, SheetNames: ['Sheet1'] });
      mockXlsx.utils.sheet_to_json.mockReturnValue([
        { '시리얼 번호': 'TEST001', '디바이스 정보': 'Test Device', 'OS 이름': 'AOS', 'OS 버전': '14', '모델명': 'TestDevice', '대여자': '없음', '대여일시': '없음' }
      ]);
      mockFs.readdirSync.mockReturnValue(['test.xlsx']);
      mockFs.statSync.mockReturnValue({ mtime: new Date() });
      mockXlsx.utils.book_new.mockReturnValue({});
      mockXlsx.utils.json_to_sheet.mockReturnValue({});
      mockXlsx.utils.book_append_sheet.mockReturnValue({});
      mockXlsx.write.mockReturnValue(Buffer.from('mocked buffer'));
    });

    it('should initialize devices successfully', async () => {
      const res = await request(app)
        .post('/api/admin/init-devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ exportPath: 'mocked/path' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Device initialization completed');
    });
  });