const express = require('express');
const cors = require('cors');
const xlsx = require('xlsx');
const jwt = require('jsonwebtoken');
const app = express();

app.use(cors()); // 프론트엔드 도메인 허용 (모든 도메인 허용, 필요 시 특정 도메인 지정 가능)
app.use(express.json());

// 엑셀 파일 경로 (예: device-data.xlsx)
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

// 더미 사용자 데이터 (실제로는 데이터베이스 사용)
const users = [
  { username: "user1", password: "pass123" }, // 비밀번호는 bcrypt로 해시 필요
];

// JWT 시크릿 키 (실제로는 환경 변수로 관리)
const JWT_SECRET = "your-secret-key";

// 로그인 엔드포인트
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (user) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } else {
    res.status(401).json({ message: "Invalid credentials" });
  }
});

app.get('/api/data', (req, res) => {
  // JWT 토큰 검증 (선택, 로그인 후 데이터 접근 제어)
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