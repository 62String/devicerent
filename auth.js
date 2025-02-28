const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const app = express();

app.use(cors());

app.use(express.json());

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'test' && password === 'password') {
    const token = jwt.sign({ username }, '비밀열쇠12345678', { expiresIn: '30m' });
    res.json({ token });
  } else {
    res.status(401).send('실패!');
  }
});

let devices = [
  { id: 1, name: 'iPhone 14', status: '대여 가능', rentedBy: null },
  { id: 2, name: 'Galaxy S23', status: '대여 중', rentedBy: 'test' },
];

app.get('/devices', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send('인증 필요!');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, '비밀열쇠12345678'); // 비밀키 확인
    res.json(devices);
  } catch (err) {
    res.status(401).send('유효하지 않은 토큰!');
  }
});

app.post('/devices/update', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send('인증 필요!');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, '비밀열쇠12345678'); // 비밀키 확인
    const username = decoded.username;
    const { id, status } = req.body;

    const device = devices.find(d => d.id === id);
    if (!device) return res.status(404).send('디바이스를 찾을 수 없습니다.');

    if (status === '대여 중') {
      if (device.status !== '대여 가능') return res.status(400).send('이미 대여 중입니다.');
      if (device.rentedBy) return res.status(400).send('이미 다른 사용자가 대여 중입니다.');
      device.status = '대여 중';
      device.rentedBy = username;
    } else if (status === '대여 가능') {
      if (device.status !== '대여 중') return res.status(400).send('대여 중이 아닙니다.');
      if (device.rentedBy !== username) return res.status(403).send('대여자만 반납 가능합니다.');
      device.status = '대여 가능';
      device.rentedBy = null;
    } else {
      return res.status(400).send('잘못된 상태입니다.');
    }

    res.json({ message: '업데이트 성공', devices });
  } catch (err) {
    res.status(401).send('유효하지 않은 토큰!');
  }
});

app.listen(3003, () => {
  console.log('서버 켜졌어요!');
});