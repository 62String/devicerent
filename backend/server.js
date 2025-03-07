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