const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

router.post('/register', async (req, res) => {
  const { name, affiliation, id, password, passwordConfirm, position } = req.body;
  if (!name || !affiliation || !id || !password || !passwordConfirm || !position) {
    return res.status(400).json({ message: "All fields are required, including position" });
  }
  if (typeof id !== 'string' || id.trim().length < 3) {
    return res.status(400).json({ message: "ID must be at least 3 characters" });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }
  if (password !== passwordConfirm) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  try {
    const existingUser = await User.findOne({ id: id.trim() });
    if (existingUser) return res.status(400).json({ message: "이미 존재하는 ID입니다." });

    const isAdmin = ['파트장', '팀장', '실장', '센터장'].includes(position);

    const user = new User({
      name,
      affiliation,
      id: id.trim(),
      password,
      position,
      isPending: true,
      isAdmin
    });
    await user.save();

    res.status(201).json({ message: "Registration successful, pending admin approval", user: { id: id.trim(), name, affiliation, position, isAdmin } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post('/check-id', async (req, res) => {
  const { id } = req.body;
  try {
    const existingUser = await User.findOne({ id });
    if (existingUser) {
      return res.json({ available: false });
    }
    res.json({ available: true });
  } catch (error) {
    console.error('Check ID error:', error);
    res.status(500).json({ message: '서버 오류' });
  }
});

router.post('/login', async (req, res) => {
  const { id, password } = req.body;
  try {
    const user = await User.findOne({ id: id.trim() });
    if (!user) {
      return res.status(401).json({ message: "등록되지 않은 사용자 혹은 아이디가 틀렸습니다." });
    }
    if (!(await user.comparePassword(password))) {
      return res.status(401).json({ message: "비밀번호가 일치하지 않습니다." });
    }
    if (user.isPending) {
      return res.status(403).json({ message: "승인 대기중" });
    }
    const token = jwt.sign({ id: user.id, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: user.isAdmin ? '365d' : '1h' });
    res.status(200).json({ token });
  } catch (error) {
    console.error('Login error:', error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ id: decoded.id });
    if (!user) return res.status(404).json({ message: "User not found" });
    const returnData = {
      id: user.id,
      name: user.name,
      affiliation: user.affiliation,
      position: user.position,
      isPending: user.isPending || false,
      isAdmin: user.isAdmin || false
    };
    res.json({ user: returnData });
  } catch (error) {
    console.error('Error fetching user:', error.name, error.message);
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
