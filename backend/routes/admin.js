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
    if (!decoded.username || !(await User.findOne({ username: decoded.username, isAdmin: true }))) 
      return res.status(403).json({ message: "Admin access required" });
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
    if (!decoded.username || !(await User.findOne({ username: decoded.username, isAdmin: true }))) 
      return res.status(403).json({ message: "Admin access required" });
    const { username, isAdmin = false } = req.body;
    await User.findOneAndUpdate({ username }, { isPending: false, isAdmin });
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
    if (!decoded.username || !(await User.findOne({ username: decoded.username, isAdmin: true }))) 
      return res.status(403).json({ message: "Admin access required" });
    const { username } = req.body;
    await User.findOneAndDelete({ username });
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
    if (!decoded.username || !(await User.findOne({ username: decoded.username, isAdmin: true }))) 
      return res.status(403).json({ message: "Admin access required" });
    const users = await User.find({ isPending: false });
    res.json(users.map(user => ({
      username: user.username,
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
