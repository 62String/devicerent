const express = require('express');
const router = express.Router(); // router 객체 정의 추가
const Device = require('../models/Device');
const User = require('../models/User');
const RentalHistory = require('../models/RentalHistory');
const jwt = require('jsonwebtoken');
const { adminAuth } = require('./middleware');
const xlsx = require('xlsx');
const JWT_SECRET = process.env.JWT_SECRET || '비밀열쇠12345678';

// 현재 대여 현황
router.get('/status', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    jwt.verify(token, JWT_SECRET);
    const devices = await Device.find({ rentedBy: { $ne: null } }).lean();
    res.json(devices);
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// 대여 히스토리 (모든 사용자 접근 가능)
router.get('/history', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    jwt.verify(token, JWT_SECRET);
    const history = await RentalHistory.find().sort({ timestamp: -1 }).lean();
    res.json(history);
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// 히스토리 수정 방지
router.use('/history', (req, res, next) => {
  if (req.method === 'PUT' || req.method === 'DELETE' || req.method === 'PATCH') {
    return res.status(405).json({ message: "History data is read-only" });
  }
  next();
});

// 디바이스 관리 (등록, 삭제, 상태 변경)
router.post('/manage/register', adminAuth, async (req, res) => {
  const { serialNumber, deviceInfo, osName, osVersion, modelName } = req.body;
  try {
    const existingDevice = await Device.findOne({ serialNumber });
    if (existingDevice) return res.status(400).json({ message: "Device already exists" });

    const device = new Device({
      serialNumber,
      deviceInfo,
      osName,
      osVersion: osVersion || '',
      modelName: modelName || ''
    });
    await device.save();
    res.json({ message: "Device registered successfully", device });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post('/manage/delete', adminAuth, async (req, res) => {
  const { serialNumber } = req.body;
  try {
    const device = await Device.findOneAndDelete({ serialNumber });
    if (!device) return res.status(404).json({ message: "Device not found" });
    res.json({ message: "Device deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post('/manage/update-status', adminAuth, async (req, res) => {
  const { serialNumber, status, statusReason = '' } = req.body;
  try {
    const device = await Device.findOne({ serialNumber });
    if (!device) return res.status(404).json({ message: "Device not found" });
    device.status = status;
    device.statusReason = statusReason;
    await device.save();
    res.json({ message: "Device status updated successfully", device });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// 디바이스 목록 조회 (관리자용 - 모든 상태 포함)
router.get('/', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    jwt.verify(token, JWT_SECRET);
    const devices = await Device.find().lean();
    if (!devices || devices.length === 0) {
      return res.status(404).json({ message: "No devices found" });
    }
    res.json(devices);
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// 대여 가능한 디바이스 목록 조회 (대여창용 - active 상태만)
router.get('/available', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    jwt.verify(token, JWT_SECRET);
    const devices = await Device.find({ status: 'active', rentedBy: null }).lean();
    if (!devices || devices.length === 0) {
      return res.status(404).json({ message: "No available devices found" });
    }
    res.json(devices);
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

router.post('/rent-device', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { deviceId, remark = '' } = req.body;
    const device = await Device.findOne({ serialNumber: deviceId });
    if (!device) return res.status(404).json({ message: "Device not found" });
    if (device.rentedBy) return res.status(400).json({ message: "Device already rented" });
    if (device.status !== 'active') {
      return res.status(400).json({ message: `Device is not available (${device.status}${device.statusReason ? `: ${device.statusReason}` : ''})` });
    }

    const user = await User.findOne({ id: decoded.id });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.name || !user.affiliation || user.name.trim() === '' || user.affiliation.trim() === '') {
      return res.status(400).json({ message: "User name or affiliation is incomplete" });
    }

    device.rentedBy = { name: user.name, affiliation: user.affiliation };
    device.rentedAt = new Date();
    device.remark = remark; // 특이사항 저장
    await device.save();
    const deviceInfo = {
      modelName: device.modelName,
      osName: device.osName,
      osVersion: device.osVersion
    };
    const historyData = {
      serialNumber: device.serialNumber,
      userId: user.id,
      action: 'rent',
      userDetails: { name: user.name.trim(), affiliation: user.affiliation.trim() },
      deviceInfo: deviceInfo,
      remark: remark,
      timestamp: new Date()
    };
    await RentalHistory.create(historyData);
    res.json({ message: "Device rented successfully" });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post('/return-device', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { deviceId, status = 'active', statusReason = '' } = req.body;
    console.log('Return request for deviceId:', deviceId);
    const device = await Device.findOne({ serialNumber: deviceId });
    if (!device) return res.status(404).json({ message: "Device not found" });
    console.log('Found device:', device);
    if (!device.rentedBy) return res.status(400).json({ message: "Device is not rented" });
    const user = await User.findOne({ id: decoded.id });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.name || !user.affiliation || user.name.trim() === '' || user.affiliation.trim() === '') {
      return res.status(400).json({ message: "User name or affiliation is incomplete" });
    }

    if (device.rentedBy.name !== user.name) {
      return res.status(403).json({ message: "Cannot return this device" });
    }

    const deviceInfo = {
      modelName: device.modelName,
      osName: device.osName,
      osVersion: device.osVersion
    };
    console.log('Device info for return:', deviceInfo);
    const historyData = {
      serialNumber: device.serialNumber,
      userId: user.id,
      action: 'return',
      userDetails: { name: user.name.trim(), affiliation: user.affiliation.trim() },
      deviceInfo: deviceInfo,
      timestamp: new Date()
    };
    console.log('History data to save:', historyData);
    const historyResult = await RentalHistory.create(historyData);
    console.log('Saved history:', historyResult);
    device.rentedBy = null;
    device.rentedAt = null;
    device.status = status;
    device.statusReason = statusReason;
    await device.save();
    res.json({ message: "Device returned successfully" });
  } catch (error) {
    console.error('Return error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post('/history/export', async (req, res) => {
  const { period, startDate, endDate } = req.body;
  try {
    let query = {};
    if (period === 'week') {
      const now = new Date();
      const start = new Date(now.setDate(now.getDate() - 7));
      query.timestamp = { $gte: start, $lte: new Date() };
    } else if (period === 'month') {
      const now = new Date();
      const start = new Date(now.setMonth(now.getMonth() - 1));
      query.timestamp = { $gte: start, $lte: new Date() };
    } else if (period === 'custom' && startDate && endDate) {
      query.timestamp = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    console.log('Exporting history with query:', query);
    const history = await RentalHistory.find(query).sort({ timestamp: -1 }).lean();
    console.log('Fetched history for export:', history);

    // 월별로 데이터 그룹화
    const historyByMonth = {};
    history.forEach(record => {
      const date = new Date(record.timestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM 형식
      if (!historyByMonth[monthKey]) {
        historyByMonth[monthKey] = [];
      }
      historyByMonth[monthKey].push({
        '시리얼 번호': record.serialNumber,
        '모델명': record.deviceInfo?.modelName || 'N/A',
        'OS 이름': record.deviceInfo?.osName || 'N/A',
        'OS 버전': record.deviceInfo?.osVersion || 'N/A',
        '대여자': record.userDetails?.name || 'N/A',
        '대여 시간': record.timestamp ? new Date(record.timestamp).toLocaleString() : 'N/A',
        '반납 시간': record.action === 'return' ? new Date(record.timestamp).toLocaleString() : 'N/A',
        '특이사항': record.remark || '없음'
      });
    });

    console.log('Grouped history by month:', historyByMonth);

    // 엑셀 워크북 생성
    const wb = xlsx.utils.book_new();
    for (const monthKey in historyByMonth) {
      const ws = xlsx.utils.json_to_sheet(historyByMonth[monthKey]);
      xlsx.utils.book_append_sheet(wb, ws, monthKey); // 각 월별 시트 추가
    }

    // 워크북이 비어 있는 경우 기본 시트 추가
    if (!Object.keys(historyByMonth).length) {
      const ws = xlsx.utils.json_to_sheet([]);
      xlsx.utils.book_append_sheet(wb, ws, 'Empty');
    }

    const buffer = xlsx.write(wb, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', 'attachment; filename=history_export.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: '엑셀 내보내기 실패' });
  }
});

module.exports = router;