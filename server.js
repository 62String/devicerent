const express = require('express');
const cors = require('cors');
const xlsx = require('xlsx');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const app = express();
const { User } = require('./init.js');

app.use(cors()); // 프론트엔드 도메인 허용
app.use(express.json());

// MongoDB 연결 (로컬)
mongoose.connect('mongodb://localhost:27017/devicerent', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// 엑셀 파일 경로
const excelFile = 'device-data.xlsx';

// 엑셀 데이터 로드
let devices = [];
try {
  const workbook = xlsx.readFile(excelFile);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  devices = xlsx.utils.sheet_to_json(sheet);
} catch (error) {
  console.error('Error loading Excel file:', error);
  devices = [{ id: 1, deviceInfo: "Device123", category: "Game", osVersion: "1.0", location: "Tokyo" }];
}

// JWT 시크릿 키 (.env에서 로드, 샘플은 .env.example)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// JWT 토큰 검증 Promise로 변환
const verifyToken = (token, secret) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
      if (err) reject(err);
      else resolve(decoded);
    });
  });
};

// 회원가입 엔드포인트
app.post('/api/register', async (req, res) => {
  const { name, affiliation, username, password, passwordConfirm } = req.body;

  // 데이터 유효성 검사
  if (!name || !affiliation || !username || !password || !passwordConfirm) {
    return res.status(400).json({ message: "All fields are required" });
  }
  if (typeof username !== 'string' || username.length < 3) {
    return res.status(400).json({ message: "Username must be at least 3 characters" });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }
  if (password !== passwordConfirm) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  try {
    // username 중복 체크
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    // password 해싱
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 일반 사용자 생성 (isAdmin: false, isPending: true)
    const user = new User({
      name,
      affiliation,
      username,
      password: hashedPassword,
      isPending: true, // 승인 대기 상태
      isAdmin: false   // 일반 사용자
    });
    await user.save();

    res.json({ 
      message: "Registration successful, pending admin approval",
      user: { username, name, affiliation } 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: "Server error" });
  }
});

// 로그인 엔드포인트
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    if (user.isPending) {
      return res.status(403).json({ message: "Account pending admin approval" });
    }
    const token = jwt.sign({ username }, JWT_SECRET, { 
      expiresIn: user.isAdmin ? '365d' : '1h' // 관리자는 1년, 일반은 1시간
    });
    res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get('/api/data', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = await verifyToken(token, JWT_SECRET);
    res.json(devices[0] || { id: 1, deviceInfo: "Device123", category: "Game", osVersion: "1.0", location: "Tokyo" });
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(403).json({ message: "Invalid token" });
  }
});

app.post('/api/sync', (req, res) => {
  let syncData = req.body || {};
  syncData = {
    ...syncData,
    id: syncData.id || 1,
    deviceInfo: syncData.deviceInfo || "Device123",
    category: syncData.category || "Game",
    osVersion: syncData.osVersion || "1.0",
    location: syncData.location || "Tokyo"
  };
  delete syncData.category;
  delete syncData.osVersion;
  delete syncData.location;
  res.json(syncData);
});

app.get('/api/devices', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = await verifyToken(token, JWT_SECRET);
    const devices = [
      { id: 1, deviceInfo: "Device123", status: "Available" },
      { id: 2, deviceInfo: "Device456", status: "Rented" },
      { id: 3, deviceInfo: "Device789", status: "Maintenance" }
    ];
    res.json(devices);
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(403).json({ message: "Invalid token" });
  }
});

/**
 * 관리자 엔드포인트 - 승인 대기 사용자 목록 조회
 * GET /api/admin/requests
 * 인증된 관리자만 접근 가능, JWT 토큰 필요
 */
app.get('/api/admin/requests', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || 'your-secret-key');
    if (!decoded.username || !(await User.findOne({ username: decoded.username, isAdmin: true }))) 
      return res.status(403).json({ message: "Admin access required" });
    const pendingUsers = await User.find({ isPending: true });
    res.json(pendingUsers);
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(403).json({ message: "Invalid token" });
  }
});

/**
 * 관리자 엔드포인트 - 사용자 승인
 * POST /api/device-rental-approve
 * 인증된 관리자만 접근 가능, JWT 토큰 및 사용자명 필요
 */
app.post('/api/device-rental-approve', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || 'your-secret-key');
    if (!decoded.username || !(await User.findOne({ username: decoded.username, isAdmin: true }))) 
      return res.status(403).json({ message: "Admin access required" });
    const { username, isAdmin = false } = req.body;
    await User.findOneAndUpdate({ username }, { isPending: false, isAdmin });
    res.json({ message: "Device rental permission approved with admin status" });
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(403).json({ message: "Invalid token" });
  }
});

/**
 * 관리자 엔드포인트 - 사용자 거부
 * POST api/device-rental-rejec
 * 인증된 관리자만 접근 가능, JWT 토큰 및 사용자명 필요
 */
app.post('/api/device-rental-reject', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || 'your-secret-key');
    if (!decoded.username || !(await User.findOne({ username: decoded.username, isAdmin: true }))) 
      return res.status(403).json({ message: "Admin access required" });
    const { username } = req.body;
    await User.findOneAndDelete({ username });
    res.json({ message: "Device rental permission rejected" });
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(403).json({ message: "Invalid token" });
  }
});

app.listen(4000, () => console.log('Server running on port 4000'));