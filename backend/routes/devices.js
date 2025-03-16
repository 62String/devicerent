const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const ExportHistory = require('../models/ExportHistory');
const User = require('../models/User');
const RentalHistory = require('../models/RentalHistory');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { adminAuth } = require('./middleware');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || '비밀열쇠12345678';
const DB_RETENTION_LIMIT = 1000 * 60 * 60 * 24 * 365 * 2; // 2년 (밀리초)
const DB_SIZE_LIMIT = 0.95; // 95% 임계점
const EXPORT_DIR = 'C:\\Users\\62String\\DeviceRentalApi\\backend\\exports\\Device-list';
const apiUrl = process.env.API_URL || 'http://localhost:4000';

if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
  console.log('Created exports directory:', EXPORT_DIR);
}

// 데이터베이스 용량 체크
const checkDbStatus = async () => {
  try {
    const stats = await mongoose.connection.db.stats();
    const size = stats.dataSize;
    const storageSize = stats.storageSize;
    const isOverLimit = size / storageSize >= DB_SIZE_LIMIT;
    return {
      isOverLimit,
      size: (size / 1024 / 1024).toFixed(2),
      storageSize: (storageSize / 1024 / 1024).toFixed(2),
      canOperate: !isOverLimit
    };
  } catch (error) {
    console.error('DB status check error:', error);
    return { isOverLimit: true, canOperate: false };
  }
};

// 로그 기록용 엔드포인트
router.post('/history/exports/log', adminAuth, async (req, res) => {
  try {
    const { action, filePath, timestamp, exportType } = req.body;
    console.log(`[${new Date().toISOString()}] ${action} - File: ${filePath}`);
    await ExportHistory.create({
      timestamp: timestamp || new Date(),
      filePath: filePath,
      recordCount: 0,
      deletedCount: 0,
      performedBy: (await User.findOne({ id: jwt.verify(req.headers.authorization.split(' ')[1], JWT_SECRET).id })).name || 'Unknown',
      action: action,
      exportType: exportType || 'unknown' // 유형 추가
    });
    res.status(200).json({ message: `${action} log recorded` });
  } catch (error) {
    console.error('Log error:', error);
    res.status(500).json({ message: '로그 기록 실패' });
  }
});

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

// 2년 초과 데이터 존재 여부 확인
router.get('/history/check-retention', adminAuth, async (req, res) => {
  try {
    const query = { timestamp: { $lte: new Date(Date.now() - DB_RETENTION_LIMIT) } };
    const history = await RentalHistory.find(query).lean();
    res.status(200).json({ hasRetentionData: history.length > 0 });
  } catch (error) {
    console.error('Retention check error:', error);
    res.status(500).json({ message: '2년 초과 데이터 확인 실패' });
  }
});

// 2년 초과 데이터 익스포트 및 삭제 (관리자용)
router.post('/history/export-retention', adminAuth, async (req, res) => {
  try {
    const decoded = jwt.verify(req.headers.authorization.split(' ')[1], JWT_SECRET);
    const user = await User.findOne({ id: decoded.id });
    const performedBy = user ? user.name || 'Unknown' : 'Unknown';
    const query = { timestamp: { $lte: new Date(Date.now() - DB_RETENTION_LIMIT) } };
    console.log('Exporting retention data with query:', query);
    const history = await RentalHistory.find(query).sort({ timestamp: -1 }).lean();
    console.log('Fetched history for export:', history.length, history);

    if (history.length === 0) {
      return res.status(200).json({ message: '2년 초과 데이터가 없습니다' });
    }

    const historyByMonth = {};
    history.forEach(record => {
      const date = new Date(record.timestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
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

    const wb = xlsx.utils.book_new();
    for (const monthKey in historyByMonth) {
      const ws = xlsx.utils.json_to_sheet(historyByMonth[monthKey]);
      xlsx.utils.book_append_sheet(wb, ws, monthKey);
    }

    const fileName = `retention_export_${new Date().toISOString().replace(/[:]/g, '-')}.xlsx`;
    const filePath = path.join(EXPORT_DIR, fileName);
    const buffer = xlsx.write(wb, { bookType: 'xlsx', type: 'buffer' });

    try {
      fs.writeFileSync(filePath, buffer);
      console.log('Retention data exported to:', filePath);
    } catch (writeError) {
      console.error('File write error:', writeError);
      throw new Error('Failed to save export file');
    }

    const deleteResult = await RentalHistory.deleteMany(query);
    console.log('Deleted retention data result:', deleteResult);
    if (deleteResult.deletedCount > 0) {
      console.log(`Deleted ${deleteResult.deletedCount} records from database`);
    } else {
      console.log('No records deleted from database');
    }

    const deletedSerialNumbers = history.map(record => record.serialNumber);
    await Device.updateMany(
      { serialNumber: { $in: deletedSerialNumbers }, rentedAt: { $lte: new Date(Date.now() - DB_RETENTION_LIMIT) } },
      { $set: { rentedBy: null, rentedAt: null, remark: '' } }
    );
    console.log('Updated devices with expired rentals');

    await ExportHistory.create({
      timestamp: new Date(),
      filePath: `/exports/${fileName}`,
      recordCount: history.length,
      deletedCount: deleteResult.deletedCount,
      performedBy,
      action: 'export-retention',
      exportType: 'retention' // 리텐션 유형 추가
    });

    res.status(200).json({ message: '2년 초과 데이터 익스포트 및 삭제 완료', filePath: `${apiUrl}/exports/${fileName}` });
  } catch (error) {
    console.error('Retention export error:', error);
    res.status(error.message.includes('No data') ? 200 : 500).json({ message: error.message || '2년 초과 데이터 내보내기 실패' });
  }
});

// 히스토리 익스포트 (기간 필터링)
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

    const historyByMonth = {};
    history.forEach(record => {
      const date = new Date(record.timestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
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

    const wb = xlsx.utils.book_new();
    for (const monthKey in historyByMonth) {
      const ws = xlsx.utils.json_to_sheet(historyByMonth[monthKey]);
      xlsx.utils.book_append_sheet(wb, ws, monthKey);
    }

    if (!Object.keys(historyByMonth).length) {
      const ws = xlsx.utils.json_to_sheet([]);
      xlsx.utils.book_append_sheet(wb, ws, 'Empty');
    }

    const buffer = xlsx.write(wb, { bookType: 'xlsx', type: 'buffer' });

    // 서버 디렉토리에 저장
    const dateTime = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `history_export_${dateTime}.xlsx`;
    const filePath = path.join(EXPORT_DIR, fileName);
    try {
      fs.writeFileSync(filePath, buffer);
      console.log('History exported to:', filePath);
    } catch (writeError) {
      console.error('File write error:', writeError);
      throw new Error('Failed to save export file');
    }

    // 로그 기록
    console.log(`[${new Date().toISOString()}] export - File: ${filePath}`);
    await ExportHistory.create({
      timestamp: new Date(),
      filePath: `/exports/${fileName}`,
      recordCount: history.length,
      deletedCount: 0,
      performedBy: 'system',
      action: 'export',
      exportType: 'history' // 히스토리 유형 추가
    });

    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: '엑셀 내보내기 실패' });
  }
});

// 디바이스 목록 익스포트
router.post('/export', adminAuth, async (req, res) => {
  try {
    const devices = req.body;
    console.log('Exporting devices:', devices);

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(devices);
    xlsx.utils.book_append_sheet(wb, ws, 'Devices');

    const dateTime = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `device_list_${dateTime}.xlsx`;
    const filePath = path.join(EXPORT_DIR, fileName);
    const buffer = xlsx.write(wb, { bookType: 'xlsx', type: 'buffer' });

    // 서버 디렉토리에 저장
    try {
      fs.writeFileSync(filePath, buffer);
      console.log('Device list exported to:', filePath);
    } catch (writeError) {
      console.error('File write error:', writeError);
      throw new Error('Failed to save export file');
    }

    // 로그 기록
    console.log(`[${new Date().toISOString()}] export - File: ${filePath}`);
    await ExportHistory.create({
      timestamp: new Date(),
      filePath: `/exports/${fileName}`,
      recordCount: devices.length,
      deletedCount: 0,
      performedBy: (await User.findOne({ id: jwt.verify(req.headers.authorization.split(' ')[1], JWT_SECRET).id })).name || 'Unknown',
      action: 'export',
      exportType: 'device' // 디바이스 유형 추가
    });

    // 파일 반환
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: '엑셀 내보내기 실패' });
  }
});

// 익스포트 내역 조회 (관리자용)
router.get('/history/exports', adminAuth, async (req, res) => {
  try {
    console.log('Received query:', req.query);
    let query = {};
    if (req.query.startDate && req.query.endDate) {
      const start = new Date(req.query.startDate);
      const end = new Date(req.query.endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: 'Invalid date format' });
      }
      query.timestamp = {
        $gte: start,
        $lte: end
      };
      console.log('Applying date filter:', { start, end });
    }
    console.log('Query for ExportHistory:', query);
    const exports = await ExportHistory.find(query).sort({ timestamp: -1 }).lean();
    console.log('Fetched exports:', exports.length, exports.map(exp => exp.timestamp));
    res.json(exports);
  } catch (error) {
    console.error('Fetch export history error:', error);
    res.status(500).json({ message: '익스포트 내역 조회 실패' });
  }
});

// 익스포트 내역 최소 날짜 조회 (관리자용)
router.get('/history/exports/min-date', adminAuth, async (req, res) => {
  try {
    const oldestExport = await ExportHistory.findOne().sort({ timestamp: 1 }).lean();
    if (!oldestExport) {
      return res.status(200).json({ minDate: '2020-01-01T00:00:00.000Z' });
    }
    res.status(200).json({ minDate: oldestExport.timestamp });
  } catch (error) {
    console.error('Fetch min date error:', error);
    res.status(500).json({ message: '최소 날짜 조회 실패' });
  }
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

  const dbStatus = await checkDbStatus();
  if (!dbStatus.canOperate) {
    return res.status(503).json({
      message: `데이터베이스 용량 95% 초과 (${dbStatus.size}MB / ${dbStatus.storageSize}MB). 관리자를 불러서 DB를 정리해 달라고 요청 후 다시 시도해주세요.`
    });
  }

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
    device.remark = remark;
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

  const dbStatus = await checkDbStatus();
  if (!dbStatus.canOperate) {
    return res.status(503).json({
      message: `데이터베이스 용량 95% 초과 (${dbStatus.size}MB / ${dbStatus.storageSize}MB). 관리자를 불러서 DB를 정리해 달라고 요청 후 다시 시도해주세요.`
    });
  }

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

module.exports = router;