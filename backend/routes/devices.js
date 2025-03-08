const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const User = require('../models/User');
const jwt = require('jsonwebtoken'); // 추가
const { verifyToken } = require('../utils/auth');
const JWT_SECRET = process.env.JWT_SECRET || '비밀열쇠12345678';

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
    console.log('Device ID received:', deviceId, typeof deviceId);
    const device = await Device.findOne({ id: Number(deviceId) });
    console.log('Device found:', device);
    if (!device) return res.status(404).json({ message: "Device not found" });
    if (device.rentedBy) return res.status(400).json({ message: "Device already rented" });
    
    const user = await User.findOne({ id: decoded.id });
    if (!user) return res.status(404).json({ message: "User not found" });

    device.rentedBy = {
      name: user.name,
      affiliation: user.affiliation
    };
    device.rentedAt = new Date();
    await device.save();
    console.log('Device after save:', await Device.findOne({ id: device.id }));
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
    console.log('Device ID received:', deviceId, typeof deviceId);
    const device = await Device.findOne({ id: Number(deviceId) });
    console.log('Device found:', device);
    if (!device) return res.status(404).json({ message: "Device not found" });
    if (!device.rentedBy) return res.status(400).json({ message: "Device is not rented" });
    const user = await User.findOne({ id: decoded.id });
    if (!user) return res.status(404).json({ message: "User not found" });
    console.log('Current user:', user.name, 'Rented by:', device.rentedBy.name); // 디버깅

    if (device.rentedBy.name !== user.name) {
      return res.status(403).json({ message: "Cannot return this device" });
    }

    device.rentedBy = null;
    device.rentedAt = null;
    await device.save();
    console.log('Device after return:', await Device.findOne({ id: device.id }));
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