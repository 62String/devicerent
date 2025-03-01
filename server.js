const express = require('express');
const cors = require('cors');
const xlsx = require('xlsx');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const app = express();

app.use(cors()); // 프론트엔드 도메인 허용
app.use(express.json());

// MongoDB 연결 (로컬)
mongoose.connect('mongodb://localhost:27017/devicerent')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));
  
// 사용자 스키마
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

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

// 로그인 엔드포인트
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
      res.json({ token });
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get('/api/data', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    res.json(devices[0] || { id: 1, deviceInfo: "Device123", category: "Game", osVersion: "1.0", location: "Tokyo" });
  });
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

app.get('/api/devices', (req, res) => {
  const devices = [
    { id: 1, deviceInfo: "Device123", status: "Available" },
    { id: 2, deviceInfo: "Device456", status: "Rented" },
    { id: 3, deviceInfo: "Device789", status: "Maintenance" }
  ];
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    res.json(devices);
  });
});

app.listen(4000, () => console.log('Server running on port 4000'));