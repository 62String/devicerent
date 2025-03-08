const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { verifyToken } = require('../utils/auth');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

router.get('/requests', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = await verifyToken(token, JWT_SECRET);
    console.log('Decoded token in /requests:', decoded);
    if (!decoded.id || !(await User.findOne({ id: decoded.id, isAdmin: true }))) {
      return res.status(403).json({ message: "Admin access required" });
    }
    const pendingUsers = await User.find({ isPending: true });
    res.json(pendingUsers);
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(403).json({ message: "Invalid token" });
  }
});

router.post('/device-rental-approve', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = await verifyToken(token, JWT_SECRET);
    if (!decoded.id || !(await User.findOne({ id: decoded.id, isAdmin: true }))) {
      return res.status(403).json({ message: "Admin access required" });
    }
    const { id, isAdmin = false } = req.body; // username → id
    const user = await User.findOneAndUpdate({ id }, { isPending: false, isAdmin }, { new: true });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Device rental permission approved with admin status" });
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(403).json({ message: "Invalid token" });
  }
});

router.post('/device-rental-reject', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = await verifyToken(token, JWT_SECRET);
    if (!decoded.id || !(await User.findOne({ id: decoded.id, isAdmin: true }))) {
      return res.status(403).json({ message: "Admin access required" });
    }
    const { id } = req.body; // username → id
    const user = await User.findOneAndDelete({ id });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Device rental permission rejected" });
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(403).json({ message: "Invalid token" });
  }
});

router.get('/users', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = await verifyToken(token, JWT_SECRET);
    if (!decoded.id || !(await User.findOne({ id: decoded.id, isAdmin: true }))) {
      return res.status(403).json({ message: "Admin access required" });
    }
    const users = await User.find({ isPending: false });
    res.json(users.map(user => ({
      id: user.id, // username → id
      name: user.name,
      affiliation: user.affiliation,
      isAdmin: user.isAdmin
    })));
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(403).json({ message: "Invalid token" });
  }
});

module.exports = router;