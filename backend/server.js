require('dotenv').config();
const express = require('express');
const cors = require('cors');
const xlsx = require('xlsx');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { verifyToken } = require('./utils/auth');

const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const approveRoutes = require('./routes/admin/approve');   // 수정
const usersRoutes = require('./routes/admin/users');       // 수정
const Device = require('./models/Device');
const User = require('./models/User');


const app = express();

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/admin', approveRoutes);  // 수정
app.use('/api/admin', usersRoutes);    // 수정

const excelFile = process.env.EXCEL_FILE_PATH || './device-data.xlsx';
const initDevices = async () => {
  try {
    const count = await Device.countDocuments();
    if (count === 0) {
      const workbook = xlsx.readFile(excelFile);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawDevices = xlsx.utils.sheet_to_json(sheet);
      if (!rawDevices || rawDevices.length === 0) {
        console.log('No devices found in Excel file');
        return;
      }
      const devices = [];
      const invalidDevices = [];
      rawDevices.forEach((device, index) => {
        if (!device.SerialNumber || !device.DeviceInfo) {
          invalidDevices.push({ index, device });
        } else {
          devices.push({
            serialNumber: device.SerialNumber, // ID → SerialNumber
            deviceInfo: device.DeviceInfo,
            osName: device.OSName || 'Unknown', // Category → OSName
            osVersion: device.OSVersion || '',
            modelName: device.ModelName || '', // 새 필드 추가
            rentedBy: null,
            rentedAt: null
          });
        }
      });
      if (invalidDevices.length > 0) {
        console.log('Invalid devices skipped:', invalidDevices);
      }
      if (devices.length === 0) {
        console.log('No valid devices to insert');
        return;
      }
      await Device.insertMany(devices);
      console.log('Devices initialized from Excel:', devices.length);
    }
  } catch (error) {
    console.error('Error initializing devices:', error);
  }
};

mongoose.connect('mongodb://localhost:27017/devicerent')
  .then(() => {
    console.log('MongoDB connected');
    initDevices();
  })
  .catch(err => console.error('MongoDB connection error:', err));

app.get('/api/data', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || '비밀열쇠12345678');
    const user = await User.findOne({ id: decoded.id });
    if (!user || user.isPending) return res.status(403).json({ message: "Access denied" });
    res.json({ message: "User data", data: [{ id: 1, name: "Device Data" }] });
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(403).json({ message: "Invalid token" });
  }
});

app.get('/api/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || '비밀열쇠12345678');
    const user = await User.findOne({ id: decoded.id });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      user: {
        id: user.id,
        name: user.name,
        affiliation: user.affiliation,
        isPending: user.isPending || false,
        isAdmin: user.isAdmin || false
      }
    });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(401).json({ message: "Invalid token" });
  }
});

app.post('/api/sync', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || '비밀열쇠12345678');
    if (!decoded.id || !(await User.findOne({ id: decoded.id, isAdmin: true }))) {
      return res.status(403).json({ message: "Admin access required" });
    }
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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));