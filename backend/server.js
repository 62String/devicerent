require('dotenv').config();
const express = require('express');
const cors = require('cors');
const xlsx = require('xlsx');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken'); // 추가: auth.js에서 사용

const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const adminRoutes = require('./routes/admin');
const Device = require('./models/Device');

const app = express();

// 미들웨어
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// auth.js에서 가져온 디바이스 데이터
let devices = [
  { id: 1, name: 'iPhone 14', status: '대여 가능', rentedBy: null },
  { id: 2, name: 'Galaxy S23', status: '대여 중', rentedBy: 'test' },
];

// 기존 initDevices 함수
const excelFile = process.env.EXCEL_FILE_PATH || './device-data.xlsx';
const initDevices = async () => {
  try {
    const count = await Device.countDocuments();
    if (count === 0) {
      const workbook = xlsx.readFile(excelFile);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawDevices = xlsx.utils.sheet_to_json(sheet);
      const devices = rawDevices.map(device => ({
        id: device.id || 1,           // 기본값 1
        deviceInfo: device.deviceInfo || 'Default Device', // 기본값
        category: device.category,
        osVersion: device.osVersion,
        location: device.location,
        rentedBy: null,
        rentedAt: null
      }));
      await Device.insertMany(devices);
      console.log('Devices initialized from Excel');
    }
  } catch (error) {
    console.error('Error initializing devices:', error);
  }
};

// MongoDB 연결
mongoose.connect('mongodb://localhost:27017/devicerent')
  .then(() => {
    console.log('MongoDB connected');
    initDevices();
  })
  .catch(err => console.error('MongoDB connection error:', err));

// 기존 라우터 연결
app.use('/api', authRoutes);
app.use('/api', deviceRoutes);
app.use('/api/admin', adminRoutes);

// auth.js에서 가져온 라우팅 추가
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'test' && password === 'password') {
    const token = jwt.sign({ username }, '비밀열쇠12345678', { expiresIn: '30m' });
    res.json({ token });
  } else {
    res.status(401).send('실패!');
  }
});

app.get('/devices', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send('인증 필요!');
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, '비밀열쇠12345678');
    res.json(devices);
  } catch (err) {
    res.status(401).send('유효하지 않은 토큰!');
  }
});

app.post('/devices/update', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send('인증 필요!');
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, '비밀열쇠12345678');
    const username = decoded.username;
    const { id, status } = req.body;

    const device = devices.find(d => d.id === id);
    if (!device) return res.status(404).send('디바이스를 찾을 수 없습니다.');

    if (status === '대여 중') {
      if (device.status !== '대여 가능') return res.status(400).send('이미 대여 중입니다.');
      if (device.rentedBy) return res.status(400).send('이미 다른 사용자가 대여 중입니다.');
      device.status = '대여 중';
      device.rentedBy = username;
    } else if (status === '대여 가능') {
      if (device.status !== '대여 중') return res.status(400).send('대여 중이 아닙니다.');
      if (device.rentedBy !== username) return res.status(403).send('대여자만 반납 가능합니다.');
      device.status = '대여 가능';
      device.rentedBy = null;
    } else {
      return res.status(400).send('잘못된 상태입니다.');
    }

    res.json({ message: '업데이트 성공', devices });
  } catch (err) {
    res.status(401).send('유효하지 않은 토큰!');
  }
});

// 기존 엔드포인트 (나중에 라우팅 화 가능)
app.get('/api/data', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findOne({ username: decoded.username });
    if (!user || user.isPending) return res.status(403).json({ message: "Access denied" });
    res.json({ message: "User data", data: [{ id: 1, name: "Device Data" }] });
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(403).json({ message: "Invalid token" });
  }
});

app.post('/api/sync', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || 'your-secret-key');
    if (!decoded.username || !(await User.findOne({ username: decoded.username, isAdmin: true }))) 
      return res.status(403).json({ message: "Admin access required" });
    let syncData = req.body || {};
    syncData = { ...syncData, id: syncData.id || 1, deviceInfo: syncData.deviceInfo || "Device123" };
    delete syncData.category;
    delete syncData.osVersion;
    delete syncData.location;
    res.json(syncData);
  } catch (err) {
    console.error('Sync error:', err);
    return res.status(403).json({ message: "Invalid token" });
  }
});

// 서버 실행
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));