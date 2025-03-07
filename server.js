const express = require('express');
const cors = require('cors');
const xlsx = require('xlsx');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const app = express();
const User = require('./models/User');

app.use(cors({
  origin: 'http://localhost:3000' // 프론트엔드 도메인 (예: React)
}));
app.use(express.json());

// MongoDB 연결 (로컬)
mongoose.connect('mongodb://localhost:27017/devicerent')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// 엑셀 파일 경로
const excelFile = process.env.EXCEL_FILE_PATH || './device-data.xlsx';

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

// 일반 사용자 데이터 조회 엔드포인트: 승인된 사용자만 접근 가능
app.get('/api/data', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findOne({ username: decoded.username });
    if (!user || user.isPending) return res.status(403).json({ message: "Access denied" });
    res.json({ message: "User data", data: [{ id: 1, name: "Device Data" }] });
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(403).json({ message: "Invalid token" });
  }
});

app.post('/api/sync', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || 'your-secret-key');
    if (!decoded.username || !(await User.findOne({ username: decoded.username, isAdmin: true }))) 
      return res.status(403).json({ message: "Admin access required" });
    let syncData = req.body || {};
    syncData = {
      ...syncData,
      id: syncData.id || 1,
      deviceInfo: syncData.deviceInfo || "Device123"
    };
    delete syncData.category;
    delete syncData.osVersion;
    delete syncData.location;
    res.json(syncData);
  } catch (err) {
    console.error('Sync error:', err);
    return res.status(403).json({ message: "Invalid token" });
  }
});

// 디바이스 조회 엔드포인트: 승인된 사용자만 접근 가능
app.get('/api/devices', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = await verifyToken(token, JWT_SECRET);
    const user = await User.findOne({ username: decoded.username });
    if (!user || user.isPending) return res.status(403).json({ message: "Access denied" });

    const devices = await Device.find()
      .select('id deviceInfo category osVersion location rentedBy rentedAt')
      .populate('rentedBy', 'username'); // 대여자 이름 포함
    res.json({ message: "All devices", devices });
  } catch (err) {
    console.error('Device fetch error:', err);
    res.status(500).json({ message: "Server error" });
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

// 수정 /api/users (인증된 전체 사용자, isAdmin 구분)
app.get('/api/users', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || 'your-secret-key');
    if (!decoded.username || !(await User.findOne({ username: decoded.username, isAdmin: true }))) 
      return res.status(403).json({ message: "Admin access required" });
    const users = await User.find({ isPending: false });
    res.json(users.map(user => ({
      username: user.username,
      name: user.name,
      affiliation: user.affiliation,
      isAdmin: user.isAdmin // 일반/관리자 구분
    })));
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(403).json({ message: "Invalid token" });
  }
});


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
