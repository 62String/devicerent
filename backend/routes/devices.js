const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const User = require('../models/User');
const RentalHistory = require('../models/RentalHistory');
const jwt = require('jsonwebtoken');
const { verifyToken } = require('../utils/auth');
const { adminAuth } = require('../middleware'); // adminAuth 추가
const JWT_SECRET = process.env.JWT_SECRET || '비밀열쇠12345678';

// 현재 대여 현황
router.get('/status', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  console.log('Status token received:', token);
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Decoded token:', decoded);
    const devices = await Device.find({ rentedBy: { $ne: null } }).lean();
    console.log('Devices with status fetched:', devices.length);
    res.json(devices);
  } catch (error) {
    console.error('Error fetching device status:', error.stack);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 대여 히스토리
router.get('/history', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  console.log('History token received:', token);
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Decoded token:', decoded);
    const history = await RentalHistory.find().sort({ timestamp: -1 }).lean();
    console.log('Rental history fetched:', history.length);
    res.json(history);
  } catch (error) {
    console.error('Error fetching rental history:', error.stack);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 디바이스 관리 (등록, 삭제, 상태 변경)
router.post('/manage/register', adminAuth, async (req, res) => {
  const { serialNumber, deviceInfo, osName, osVersion, modelName } = req.body;
  console.log('Register request:', req.body);
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
    console.log('Device registered:', device);
    res.json({ message: "Device registered successfully", device });
  } catch (error) {
    console.error('Error registering device:', error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post('/manage/delete', adminAuth, async (req, res) => {
  const { serialNumber } = req.body;
  console.log('Delete request for:', serialNumber);
  try {
    const device = await Device.findOneAndDelete({ serialNumber });
    if (!device) return res.status(404).json({ message: "Device not found" });
    console.log('Device deleted:', device);
    res.json({ message: "Device deleted successfully" });
  } catch (error) {
    console.error('Error deleting device:', error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post('/manage/update-status', adminAuth, async (req, res) => {
  const { serialNumber, status } = req.body; // status: 'active', 'repair', 'inactive'
  console.log('Update status request:', req.body);
  try {
    const device = await Device.findOne({ serialNumber });
    if (!device) return res.status(404).json({ message: "Device not found" });
    device.status = status; // 상태 필드 추가 필요 (아래 모델 수정 참고)
    await device.save();
    console.log('Device status updated:', device);
    res.json({ message: "Device status updated successfully", device });
  } catch (error) {
    console.error('Error updating device status:', error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get('/', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  console.log('Token received:', token);
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Decoded token:', decoded);
    const devices = await Device.find().lean();
    console.log('Devices fetched:', devices.length);
    if (!devices || devices.length === 0) {
      return res.status(404).json({ message: "No devices found" });
    }
    res.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error.stack);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post('/rent-device', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  console.log('Rent token received:', token);
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { deviceId } = req.body;
    console.log('Device SerialNumber received:', deviceId, typeof deviceId);
    const device = await Device.findOne({ serialNumber: deviceId });
    console.log('Device found:', device);
    if (!device) return res.status(404).json({ message: "Device not found" });
    if (device.rentedBy) return res.status(400).json({ message: "Device already rented" });
    if (device.status !== 'active') return res.status(400).json({ message: "Device is not available" });
    
    const user = await User.findOne({ id: decoded.id });
    if (!user) return res.status(404).json({ message: "User not found" });

    device.rentedBy = { name: user.name, affiliation: user.affiliation };
    device.rentedAt = new Date();
    await device.save();
    await RentalHistory.create({
      serialNumber: device.serialNumber,
      userId: user.id,
      action: 'rent',
      userDetails: { name: user.name, affiliation: user.affiliation }
    });
    console.log('Device after save:', await Device.findOne({ serialNumber: device.serialNumber }));
    res.json({ message: "Device rented successfully" });
  } catch (error) {
    console.error('Error renting device:', error.stack);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post('/return-device', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  console.log('Return token received:', token);
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { deviceId } = req.body;
    console.log('Device SerialNumber received:', deviceId, typeof deviceId);
    const device = await Device.findOne({ serialNumber: deviceId });
    console.log('Device found:', device);
    if (!device) return res.status(404).json({ message: "Device not found" });
    if (!device.rentedBy) return res.status(400).json({ message: "Device is not rented" });
    const user = await User.findOne({ id: decoded.id });
    if (!user) return res.status(404).json({ message: "User not found" });
    console.log('Current user:', user.name, 'Rented by:', device.rentedBy.name);

    if (device.rentedBy.name !== user.name) {
      return res.status(403).json({ message: "Cannot return this device" });
    }

    await RentalHistory.create({
      serialNumber: device.serialNumber,
      userId: user.id,
      action: 'return',
      userDetails: { name: user.name, affiliation: user.affiliation }
    });
    device.rentedBy = null;
    device.rentedAt = null;
    await device.save();
    console.log('Device after return:', await Device.findOne({ serialNumber: device.serialNumber }));
    res.json({ message: "Device returned successfully" });
  } catch (error) {
    console.error('Error returning device:', error.stack);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;