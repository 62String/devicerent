const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const User = require('../models/User');
const RentalHistory = require('../models/RentalHistory');
const jwt = require('jsonwebtoken');
const { adminAuth } = require('./middleware');
const JWT_SECRET = process.env.JWT_SECRET || '비밀열쇠12345678';

// 현재 대여 현황
router.get('/status', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    jwt.verify(token, JWT_SECRET);
    const devices = await Device.find({ rentedBy: { $ne: null } }).lean();
    res.json(devices);
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// 대여 히스토리 (모든 사용자 접근 가능)
router.get('/history', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    jwt.verify(token, JWT_SECRET);
    const history = await RentalHistory.find().sort({ timestamp: -1 }).lean();
    res.json(history);
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// 히스토리 수정 방지
router.use('/history', (req, res, next) => {
  if (req.method === 'PUT' || req.method === 'DELETE' || req.method === 'PATCH') {
    return res.status(405).json({ message: "History data is read-only" });
  }
  next();
});

// 디바이스 관리 (등록, 삭제, 상태 변경)
router.post('/manage/register', adminAuth, async (req, res) => {
  const { serialNumber, deviceInfo, osName, osVersion, modelName } = req.body;
  try {
    const existingDevice = await Device.findOne({ serialNumber });
    if (existingDevice) return res.status(400).json({ message: "Device already exists" });

    const device = new Device({
      serialNumber,
      deviceInfo,
      osName,
      osVersion: osVersion || '',
      modelName: modelName || ''
    });
    await device.save();
    res.json({ message: "Device registered successfully", device });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post('/manage/delete', adminAuth, async (req, res) => {
  const { serialNumber } = req.body;
  try {
    const device = await Device.findOneAndDelete({ serialNumber });
    if (!device) return res.status(404).json({ message: "Device not found" });
    res.json({ message: "Device deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post('/manage/update-status', adminAuth, async (req, res) => {
  const { serialNumber, status, statusReason = '' } = req.body;
  try {
    const device = await Device.findOne({ serialNumber });
    if (!device) return res.status(404).json({ message: "Device not found" });
    device.status = status;
    device.statusReason = statusReason;
    await device.save();
    res.json({ message: "Device status updated successfully", device });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// 디바이스 목록 조회 (관리자용 - 모든 상태 포함)
router.get('/', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    jwt.verify(token, JWT_SECRET);
    const devices = await Device.find().lean();
    if (!devices || devices.length === 0) {
      return res.status(404).json({ message: "No devices found" });
    }
    res.json(devices);
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// 대여 가능한 디바이스 목록 조회 (대여창용 - active 상태만)
router.get('/available', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    jwt.verify(token, JWT_SECRET);
    const devices = await Device.find({ status: 'active', rentedBy: null }).lean();
    if (!devices || devices.length === 0) {
      return res.status(404).json({ message: "No available devices found" });
    }
    res.json(devices);
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

router.post('/rent-device', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { deviceId } = req.body;
    const device = await Device.findOne({ serialNumber: deviceId });
    if (!device) return res.status(404).json({ message: "Device not found" });
    if (device.rentedBy) return res.status(400).json({ message: "Device already rented" });
    if (device.status !== 'active') {
      return res.status(400).json({
        message: `Device is not available (${device.status}${device.statusReason ? `: ${device.statusReason}` : ''})`
      });
    }

    const user = await User.findOne({ id: decoded.id });
    if (!user) return res.status(404).json({ message: "User not found" });

    device.rentedBy = { name: user.name, affiliation: user.affiliation };
    device.rentedAt = new Date();
    await device.save();
    const historyResult = await RentalHistory.create({
      serialNumber: device.serialNumber,
      userId: user.id,
      action: 'rent',
      userDetails: { name: user.name || 'N/A', affiliation: user.affiliation || 'N/A' },
      timestamp: new Date()
    });
    console.log('Rental history created:', historyResult);
    res.json({ message: "Device rented successfully" });
  } catch (error) {
    console.error('Rent error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

router.post('/return-device', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { deviceId, status = 'active', statusReason = '' } = req.body;
    const device = await Device.findOne({ serialNumber: deviceId });
    if (!device) return res.status(404).json({ message: "Device not found" });
    if (!device.rentedBy) return res.status(400).json({ message: "Device is not rented" });
    const user = await User.findOne({ id: decoded.id });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (device.rentedBy.name !== user.name) {
      return res.status(403).json({ message: "Cannot return this device" });
    }

    const historyResult = await RentalHistory.create({
      serialNumber: device.serialNumber,
      userId: user.id,
      action: 'return',
      userDetails: { name: user.name || 'N/A', affiliation: user.affiliation || 'N/A' },
      timestamp: new Date()
    });
    console.log('Return history created:', historyResult);
    device.rentedBy = null;
    device.rentedAt = null;
    device.status = status;
    device.statusReason = statusReason;
    await device.save();
    res.json({ message: "Device returned successfully" });
  } catch (error) {
    console.error('Return error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;