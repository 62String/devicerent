const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || '비밀열쇠12345678';

router.post('/register', async (req, res) => {
  console.log('Received body:', req.body);
  const { name, affiliation, id, password, passwordConfirm } = req.body;
  if (!name || !affiliation || !id || !password || !passwordConfirm) {
    return res.status(400).json({ message: "All fields are required" });
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
    if (existingUser) return res.status(400).json({ message: "ID already exists" });

    const user = new User({
      name,
      affiliation,
      id: id.trim(),
      username: id.trim(), // id를 username으로 사용 (선택)
      password,
      isPending: true,
      isAdmin: false
    });
    await user.save();

    res.json({ message: "Registration successful, pending admin approval", user: { id: id.trim(), name, affiliation } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post('/login', async (req, res) => {
  const { id, password } = req.body;
  try {
    console.log('Login attempt:', { id: id.trim(), password });
    const user = await User.findOne({ id: id.trim() });
    console.log('User found:', user);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    if (user.isPending) {
      return res.status(403).json({ message: "Account pending admin approval" });
    }
    if (!(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign({ id }, JWT_SECRET, { expiresIn: user.isAdmin ? '365d' : '1h' });
    console.log('Token generated:', token); // 디버깅
    res.json({ token });
  } catch (error) {
    console.error('Login error:', error.stack); // 스택 트레이스
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;