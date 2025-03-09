const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || '비밀열쇠12345678';

router.post('/register', async (req, res) => {
  console.log('Received body:', req.body);
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
    if (existingUser) return res.status(400).json({ message: "ID already exists" });

    // 파트장 이상 직급에 대해 isAdmin: true 설정
    const isAdmin = ['파트장', '팀장', '실장', '센터장'].includes(position);
    console.log('Position:', position, 'isAdmin set to:', isAdmin); // 디버깅 로그

    const user = new User({
      name,
      affiliation,
      id: id.trim(),
      password,
      position,
      isPending: true,
      isAdmin // 동적 설정
    });
    console.log('User before save:', user); // 저장 전 로그
    await user.save();
    console.log('User after save:', user); // 저장 후 로그

    res.json({ message: "Registration successful, pending admin approval", user: { id: id.trim(), name, affiliation, position, isAdmin } });
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
    console.log('User found from DB:', user); // DB에서 가져온 사용자
    if (!user) {
      return res.status(401).json({ message: "등록되지 않은 사용자 혹은 아이디가 틀렸습니다." });
    }
    if (!(await user.comparePassword(password))) {
      return res.status(401).json({ message: "비밀번호가 일치하지 않습니다." });
    }
    if (user.isPending) {
      return res.status(403).json({ message: "승인 대기중" });
    }
    console.log('User isAdmin before token:', user.isAdmin); // 토큰 생성 전
    const token = jwt.sign({ id: user.id, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: user.isAdmin ? '365d' : '1h' });
    console.log('Token generated with isAdmin:', user.isAdmin); // 토큰 생성 후
    res.json({ token });
  } catch (error) {
    console.error('Login error:', error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  console.log('Me token received:', token);
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Decoded token:', decoded);
    const user = await User.findOne({ id: decoded.id });
    console.log('User found from DB:', user); // 명확한 로그
    if (!user) return res.status(404).json({ message: "User not found" });
    const returnData = {
      id: user.id,
      name: user.name,
      affiliation: user.affiliation,
      isPending: user.isPending || false,
      isAdmin: user.isAdmin || false
    };
    console.log('Returning user data:', returnData); // 반환 데이터 로그
    res.json({ user: returnData });
  } catch (error) {
    console.error('Error fetching user:', error.stack);
    console.log('JWT_SECRET:', JWT_SECRET); // 디버깅 추가
    console.log('Token error details:', error.name, error.message); // 디버깅 추가
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;