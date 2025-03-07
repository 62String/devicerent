const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const User = require('../models/User');
const { verifyToken } = require('../utils/auth');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

router.get('/devices', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const devices = await Device.find(); // MongoDB에서 모든 디바이스 가져오기
    res.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post('/rent-device', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  const { deviceId } = req.body;
  try {
    const decoded = await verifyToken(token, JWT_SECRET);
    const user = await User.findOne({ username: decoded.username });
    if (!user || user.isPending) return res.status(403).json({ message: "Access denied" });

    const device = await Device.findOne({ id: deviceId });
    if (!device) return res.status(404).json({ message: "Device not found" });

    if (device.rentedBy) {
      const renter = await User.findById(device.rentedBy);
      return res.status(400).json({
        message: "대여 실패: 이미 대여 중입니다.",
        rentedBy: renter.username,
        rentedAt: device.rentedAt
      });
    }

    device.rentedBy = user._id;
    device.rentedAt = new Date();
    await device.save();
    res.json({ message: "대여 성공", device });
  } catch (err) {
    console.error('Rent device error:', err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post('/return-device', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  const { deviceId } = req.body;
  try {
    const decoded = await verifyToken(token, JWT_SECRET);
    const user = await User.findOne({ username: decoded.username });
    if (!user || user.isPending) return res.status(403).json({ message: "Access denied" });

    const device = await Device.findOne({ id: deviceId });
    if (!device) return res.status(404).json({ message: "Device not found" });
    if (!device.rentedBy) return res.status(400).json({ message: "이미 반납된 디바이스입니다" });

    device.rentedBy = null;
    device.rentedAt = null;
    await device.save();
    res.json({ message: "반납 성공" });
  } catch (err) {
    console.error('Return device error:', err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = await verifyToken(token, JWT_SECRET);
    const user = await User.findOne({ username: decoded.username }).select('_id username');
    if (!user || user.isPending) return res.status(403).json({ message: "Access denied" });
    res.json({ user });
  } catch (err) {
    console.error('Fetch me error:', err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
