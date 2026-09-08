const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const ExportHistory = require('../models/ExportHistory');
const User = require('../models/User');
const RentalHistory = require('../models/RentalHistory');
const DeviceStatusHistory = require('../models/DeviceStatusHistory');
const DeviceChangeRequest = require('../models/DeviceChangeRequest');
const DeviceChangeLog = require('../models/DeviceChangeLog');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { userAuth, adminAuth, dashboardAuth, masterAdminAuth } = require('./middleware');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const multer = require('multer'); // Multer 추가

const { JWT_SECRET } = require('../config');
const DB_RETENTION_LIMIT = 1000 * 60 * 60 * 24 * 365 * 2; // 2년 (밀리초)
const DB_SIZE_LIMIT = 0.95; // 95% 임계점
const EXPORT_DIR = process.env.EXPORT_DIR || path.join(__dirname, '..', 'exports', 'Device-list');
const apiUrl = process.env.API_URL || 'http://localhost:4000';

const normalizeRentalType = (rentalType) => {
  if (['external', 'longterm', 'business', 'trip'].includes(rentalType)) return 'external';
  if (['home', 'remote', 'work_from_home'].includes(rentalType)) return 'home';
  return 'normal';
};

const isExternalRental = (rentalType) => ['external', 'longterm'].includes(rentalType);

if (!fs.existsSync(EXPORT_DIR)) {
  try {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
    console.log('Created exports directory in routes/devices:', EXPORT_DIR);
  } catch (err) {
    console.error('Failed to create exports directory in routes/devices:', err);
  }
}

// Multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, EXPORT_DIR); // 업로드 파일 저장 경로
  },
  filename: (req, file, cb) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    cb(null, `uploaded_${timestamp}${path.extname(file.originalname)}`); // 파일 이름: uploaded_날짜시간.xlsx
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      cb(null, true); // .xlsx 파일만 허용
    } else {
      cb(new Error('Only .xlsx files are allowed'), false);
    }
  }
});


// 데이터베이스 용량 체크
const checkDbStatus = async () => {
  try {
    if (mongoose.connection.readyState !== 1) { // 1 = connected
      throw new Error('MongoDB connection not ready');
    }
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
      exportType: exportType || 'unknown'
    });
    res.status(200).json({ message: `${action} log recorded` });
  } catch (error) {
    console.error('Log error:', error);
    res.status(500).json({ message: '로그 기록 실패' });
  }
});

// 엑셀 파일 업로드 및 디바이스 초기화 라우트 추가
router.post('/admin/upload-devices', masterAdminAuth, upload.single('excelFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const filePath = path.join(EXPORT_DIR, req.file.filename);
    console.log('Uploaded file path:', filePath);

    // initDevices 함수 호출
    await initDevices(true, filePath);

    res.status(200).json({ message: 'Devices initialized successfully from uploaded file' });
  } catch (err) {
    console.error('Error in upload-devices:', err.message);
    res.status(500).json({ message: 'Error initializing devices', error: err.message });
  }
});

// 현재 대여 현황
router.get('/status', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    jwt.verify(token, JWT_SECRET);
    const devices = await Device.find({ rentedBy: { $ne: null } })
      .sort({ rentedAt: -1 })
      .lean();
    res.json(devices);
  } catch (error) {
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// 관리자 대시보드 집계 (관리자 전용)
// 주의: 2차 가공 통계(평균 대여기간/반출비율/OS 선호도)는 다음 KPI용으로 의도적으로 제외.
//       여기서는 "현재 상태" 집계만 제공한다.
const OVERDUE_HOURS = 72; // 3일 이상 미반납이면 주의(존버) 대상

router.get('/dashboard', dashboardAuth, async (req, res) => {
  try {
    const now = Date.now();
    const devices = await Device.find().lean();

    // counts.longtermApproved는 기존 프론트 호환을 위해 유지하며, 의미는 승인된 외부대여다.
    const counts = { total: devices.length, available: 0, rented: 0, longtermApproved: 0, pendingApproval: 0, maintenance: 0, overdue: 0 };
    const osDistribution = {};
    const statusDistribution = { active: 0, repair: 0, inactive: 0 };
    const rentedDevices = [];

    devices.forEach((device) => {
      // 상태 분포
      const status = device.status || 'active';
      statusDistribution[status] = (statusDistribution[status] || 0) + 1;
      if (status === 'repair' || status === 'inactive') counts.maintenance += 1;

      // OS 분포 (보유 기준)
      const os = device.osName || '미지정';
      osDistribution[os] = (osDistribution[os] || 0) + 1;

      // 대여 가능/대여중 + 경과시간
      const pendingExternal = isExternalRental(device.rentalType) && device.longTermStatus === 'pending';
      if (pendingExternal) counts.pendingApproval += 1;

      if (device.rentedBy) {
        counts.rented += 1;
        const rentalType = normalizeRentalType(device.rentalType);
        const longTermStatus = rentalType === 'external' ? (device.longTermStatus === 'approved' ? 'approved' : 'pending') : 'none';
        if (longTermStatus === 'approved') counts.longtermApproved += 1;
        const rentedAtMs = device.rentedAt ? new Date(device.rentedAt).getTime() : null;
        const elapsedHours = rentedAtMs ? Math.floor((now - rentedAtMs) / (1000 * 60 * 60)) : null;
        const overdue = longTermStatus !== 'approved' && elapsedHours !== null && elapsedHours >= OVERDUE_HOURS;
        if (overdue) counts.overdue += 1;
        rentedDevices.push({
          serialNumber: device.serialNumber,
          modelName: device.modelName || device.deviceInfo || 'N/A',
          osName: device.osName || '',
          osVersion: device.osVersion || '',
          renterName: device.rentedBy.name || '',
          affiliation: device.rentedBy.affiliation || '',
          rentedAt: device.rentedAt || null,
          rentalType,
          longTermStatus,
          approvedBy: device.approvedBy || '',
          elapsedHours,
          overdue,
        });
      } else if (status === 'active' && !pendingExternal) {
        counts.available += 1;
      }
    });

    // 경과시간 내림차순 (오래 안 돌려준 순) — null은 뒤로
    rentedDevices.sort((a, b) => (b.elapsedHours ?? -1) - (a.elapsedHours ?? -1));

    const statusChanges = (await DeviceStatusHistory.find()
      .sort({ timestamp: -1 })
      .limit(8)
      .lean())
      .map((record) => ({
        type: 'status',
        serialNumber: record.serialNumber,
        modelName: record.modelName || 'N/A',
        osName: record.osName || '',
        osVersion: record.osVersion || '',
        status: record.status,
        statusReason: record.statusReason || '',
        performedBy: record.performedBy || '알 수 없음',
        timestamp: record.timestamp,
      }));

    const approvedRequests = (await DeviceChangeRequest.find({ status: 'approved' })
      .sort({ reviewedAt: -1 })
      .limit(8)
      .lean())
      .map((record) => ({
        type: record.requestType,
        serialNumber: record.serialNumber,
        modelName: record.modelName || 'N/A',
        osName: record.osName || '',
        osVersion: record.osVersion || '',
        status: record.requestType === 'repair_needed' ? 'repair' : 'os_change',
        statusReason: record.reviewNote || record.reason || '',
        performedBy: record.reviewedBy?.name || '알 수 없음',
        timestamp: record.reviewedAt || record.updatedAt || record.createdAt,
      }));

    const directChangeLogs = (await DeviceChangeLog.find()
      .sort({ timestamp: -1 })
      .limit(8)
      .lean())
      .map((record) => ({
        type: record.changeType,
        serialNumber: record.serialNumber || 'SYSTEM',
        modelName: record.modelName || 'N/A',
        osName: record.osName || '',
        osVersion: record.osVersion || '',
        status: record.changeType,
        statusReason: record.reason || '',
        performedBy: record.performedBy || '알 수 없음',
        timestamp: record.timestamp,
      }));

    const recentDeviceChanges = [...statusChanges, ...approvedRequests, ...directChangeLogs]
      .filter((record) => record.timestamp)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);

    res.json({
      counts,
      osDistribution,
      statusDistribution,
      rentedDevices,
      recentDeviceChanges,
      recentActivity: recentDeviceChanges,
      overdueThresholdHours: OVERDUE_HOURS,
    });
  } catch (error) {
    console.error('Dashboard aggregation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ===== 외부대여 승인 워크플로우 (운영관리자 이상 전용) =====

// 승인 대기 목록
router.get('/longterm/pending', adminAuth, async (req, res) => {
  try {
    const now = Date.now();
    const devices = await Device.find({
      rentalType: { $in: ['external', 'longterm'] },
      longTermStatus: 'pending',
      $or: [
        { pendingExternalRentalBy: { $ne: null } },
        { rentedBy: { $ne: null } }
      ]
    }).lean();
    const pending = devices.map((d) => {
      const applicant = d.pendingExternalRentalBy || d.rentedBy || {};
      const requestedAt = d.pendingExternalRentalAt || d.rentedAt || null;
      const requestedAtMs = requestedAt ? new Date(requestedAt).getTime() : null;
      const elapsedHours = requestedAtMs ? Math.floor((now - requestedAtMs) / (1000 * 60 * 60)) : null;
      return {
        serialNumber: d.serialNumber,
        modelName: d.modelName || d.deviceInfo || 'N/A',
        osName: d.osName || '',
        osVersion: d.osVersion || '',
        renterName: applicant.name || '',
        affiliation: applicant.affiliation || '',
        remark: d.remark || '',
        rentedAt: requestedAt,
        elapsedHours,
        overdue: elapsedHours !== null && elapsedHours >= OVERDUE_HOURS,
      };
    }).sort((a, b) => (b.elapsedHours ?? -1) - (a.elapsedHours ?? -1));
    res.json(pending);
  } catch (error) {
    console.error('Pending list error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// 외부대여 승인 — pending → 실제 대여중
router.post('/longterm/approve', adminAuth, async (req, res) => {
  const { serialNumber } = req.body;
  try {
    const current = await Device.findOne({
      serialNumber,
      rentalType: { $in: ['external', 'longterm'] },
      longTermStatus: 'pending'
    });
    if (!current) {
      return res.status(404).json({ message: '승인 대기 중인 외부대여 건을 찾을 수 없습니다.' });
    }
    if (current.rentedBy && !current.pendingExternalRentalBy) {
      current.rentalType = 'external';
      current.longTermStatus = 'approved';
      current.approvedBy = req.user.name;
      current.approvedAt = new Date();
      await current.save();
      return res.json({ message: '외부대여가 승인되었습니다.', device: current });
    }
    if (current.rentedBy) {
      return res.status(409).json({ message: '이미 대여 중인 디바이스라 외부대여를 승인할 수 없습니다.' });
    }
    if (!current.pendingExternalRentalBy) {
      return res.status(404).json({ message: '외부대여 신청자 정보를 찾을 수 없습니다.' });
    }

    const approvedAt = new Date();
    current.rentedBy = current.pendingExternalRentalBy;
    current.rentedAt = approvedAt;
    current.rentalType = 'external';
    current.longTermStatus = 'approved';
    current.approvedBy = req.user.name;
    current.approvedAt = approvedAt;
    current.pendingExternalRentalBy = null;
    current.pendingExternalRentalAt = null;
    await current.save();

    const applicant = current.rentedBy;
    await RentalHistory.create({
      deviceId: current._id,
      serialNumber: current.serialNumber,
      userId: applicant.id || applicant.name,
      action: 'rent',
      rentalType: 'external',
      longTermStatus: 'approved',
      userDetails: {
        name: applicant.name || 'Unknown',
        affiliation: applicant.affiliation || 'N/A'
      },
      deviceInfo: {
        modelName: current.modelName,
        osName: current.osName,
        osVersion: current.osVersion
      },
      remark: current.remark || '',
      timestamp: current.rentedAt
    });

    res.json({ message: '외부대여가 승인되었습니다.', device: current });
  } catch (error) {
    console.error('External approve error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// 외부대여 거절 — pending 잠금 해제
router.post('/longterm/reject', adminAuth, async (req, res) => {
  const { serialNumber } = req.body;
  try {
    const device = await Device.findOneAndUpdate(
      {
        serialNumber,
        rentalType: { $in: ['external', 'longterm'] },
        longTermStatus: 'pending'
      },
      {
        $set: {
          rentedBy: null,
          rentedAt: null,
          rentalType: 'normal',
          longTermStatus: 'none',
          approvedBy: '',
          approvedAt: null,
          pendingExternalRentalBy: null,
          pendingExternalRentalAt: null,
          remark: ''
        }
      },
      { new: true }
    );
    if (!device) {
      return res.status(404).json({ message: '승인 대기 중인 외부대여 건을 찾을 수 없습니다.' });
    }
    res.json({ message: '외부대여 신청이 거절되어 대여 가능 상태로 전환되었습니다.', device });
  } catch (error) {
    console.error('External reject error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ===== 디바이스 정보/상태 제보 승인 워크플로우 =====

router.post('/change-requests', userAuth, async (req, res) => {
  const { serialNumber, requestType, proposedValue = null, reason = '' } = req.body;
  if (!serialNumber) return res.status(400).json({ message: 'Serial number is required' });
  if (!['os_change', 'repair_needed'].includes(requestType)) {
    return res.status(400).json({ message: 'Invalid request type' });
  }

  try {
    const device = await Device.findOne({ serialNumber }).lean();
    if (!device) return res.status(404).json({ message: 'Device not found' });

    const existingPendingRequest = await DeviceChangeRequest.findOne({ serialNumber, status: 'pending' }).lean();
    if (existingPendingRequest) {
      return res.status(409).json({ message: '이미 승인 대기 중인 디바이스 제보가 있습니다.' });
    }

    const currentValue = requestType === 'os_change'
      ? { osName: device.osName || '', osVersion: device.osVersion || '' }
      : { status: device.status || 'active', statusReason: device.statusReason || '' };

    const normalizedProposedValue = requestType === 'os_change'
      ? {
          osName: String(proposedValue?.osName || device.osName || '').trim(),
          osVersion: String(proposedValue?.osVersion || '').trim()
        }
      : {
          status: 'repair',
          statusReason: String(proposedValue?.statusReason || reason || '').trim()
        };

    const request = await DeviceChangeRequest.create({
      serialNumber: device.serialNumber,
      modelName: device.modelName || device.deviceInfo || 'N/A',
      osName: device.osName || '',
      osVersion: device.osVersion || '',
      requestType,
      currentValue,
      proposedValue: normalizedProposedValue,
      reason: String(reason || '').trim(),
      submittedBy: {
        id: req.user.id,
        name: req.user.name,
        affiliation: req.user.affiliation || ''
      }
    });

    res.status(201).json({ message: '제보가 승인 대기 목록에 등록되었습니다.', request });
  } catch (error) {
    console.error('Create device change request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/change-requests', adminAuth, async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : null;
  try {
    const query = status ? { status } : {};
    const requests = await DeviceChangeRequest.find(query).sort({ createdAt: -1 }).lean();
    res.json(requests);
  } catch (error) {
    console.error('Fetch device change requests error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/change-requests/:id/approve', adminAuth, async (req, res) => {
  const { reviewNote = '' } = req.body;
  try {
    const request = await DeviceChangeRequest.findOne({ _id: req.params.id, status: 'pending' });
    if (!request) return res.status(404).json({ message: '승인 대기 중인 제보를 찾을 수 없습니다.' });

    const device = await Device.findOne({ serialNumber: request.serialNumber });
    if (!device) return res.status(404).json({ message: 'Device not found' });

    if (request.requestType === 'os_change') {
      device.osName = String(request.proposedValue?.osName || device.osName || '').trim();
      device.osVersion = String(request.proposedValue?.osVersion || '').trim();
    } else if (request.requestType === 'repair_needed') {
      device.status = 'repair';
      device.statusReason = String(request.proposedValue?.statusReason || request.reason || '').trim();
    }

    await device.save();

    if (request.requestType === 'repair_needed') {
      await DeviceStatusHistory.create({
        serialNumber: device.serialNumber,
        modelName: device.modelName || device.deviceInfo || 'N/A',
        osName: device.osName || '',
        osVersion: device.osVersion || '',
        status: 'repair',
        statusReason: device.statusReason || '',
        performedBy: req.user.name || 'Unknown'
      });
    }

    request.status = 'approved';
    request.reviewedBy = { id: req.user.id, name: req.user.name };
    request.reviewedAt = new Date();
    request.reviewNote = String(reviewNote || '').trim();
    await request.save();

    res.json({ message: '제보가 승인되어 디바이스 정보에 반영되었습니다.', request, device });
  } catch (error) {
    console.error('Approve device change request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/change-requests/:id/reject', adminAuth, async (req, res) => {
  const { reviewNote = '' } = req.body;
  try {
    const request = await DeviceChangeRequest.findOne({ _id: req.params.id, status: 'pending' });
    if (!request) return res.status(404).json({ message: '승인 대기 중인 제보를 찾을 수 없습니다.' });

    request.status = 'rejected';
    request.reviewedBy = { id: req.user.id, name: req.user.name };
    request.reviewedAt = new Date();
    request.reviewNote = String(reviewNote || '').trim();
    await request.save();

    res.json({ message: '제보가 반려되었습니다.', request });
  } catch (error) {
    console.error('Reject device change request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// 기기별 대여 히스토리 (관리자 전용)
router.get('/history/device/:serialNumber', adminAuth, async (req, res) => {
  try {
    const serialNumber = String(req.params.serialNumber || '').trim();
    if (!serialNumber) {
      return res.status(400).json({ message: '시리얼 번호가 필요합니다.' });
    }

    const history = await RentalHistory.find({ serialNumber }).sort({ timestamp: -1 }).lean();
    res.json(history);
  } catch (error) {
    console.error('Fetch device rental history error:', error);
    res.status(500).json({ message: 'Server error' });
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
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
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
router.post('/history/export-retention', masterAdminAuth, async (req, res) => {
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
      exportType: 'retention'
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
      exportType: 'history'
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
      exportType: 'device'
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
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post('/manage/delete', masterAdminAuth, async (req, res) => {
  const { serialNumber } = req.body;
  try {
    const device = await Device.findOneAndDelete({ serialNumber, rentedBy: null, pendingExternalRentalBy: null });
    if (!device) {
      const existingDevice = await Device.findOne({ serialNumber }).select('rentedBy pendingExternalRentalBy');
      if (!existingDevice) return res.status(404).json({ message: "Device not found" });
      if (existingDevice.rentedBy) {
        return res.status(409).json({
          message: '대여 중인 디바이스는 삭제할 수 없습니다. 먼저 반납 처리해주세요.'
        });
      }
      if (existingDevice.pendingExternalRentalBy) {
        return res.status(409).json({
          message: '외부대여 승인 대기 중인 디바이스는 삭제할 수 없습니다. 먼저 승인 또는 거절 처리해주세요.'
        });
      }
      return res.status(409).json({ message: 'Device state changed. Please try again.' });
    }
    res.json({ message: "Device deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post('/manage/update-details', adminAuth, async (req, res) => {
  const { serialNumber, deviceInfo, modelName, osName, osVersion, details = {} } = req.body;
  if (!serialNumber) return res.status(400).json({ message: 'Serial number is required' });

  const detailKeys = [
    'sourceSheet', 'sourceStatus', 'category', 'deviceType', 'manufacturer', 'modelNumber',
    'chipset', 'cpu', 'gpu', 'memory', 'bluetooth', 'screenSize', 'resolution',
    'registeredAt', 'checkedAt', 'note', 'udid'
  ];
  const sanitizedDetails = Object.fromEntries(detailKeys.map((key) => [key, String(details[key] || '').trim()]));

  try {
    const beforeDevice = await Device.findOne({ serialNumber }).lean();
    if (!beforeDevice) return res.status(404).json({ message: 'Device not found' });

    const device = await Device.findOneAndUpdate(
      { serialNumber },
      {
        $set: {
          deviceInfo: String(deviceInfo || modelName || '').trim() || serialNumber,
          modelName: String(modelName || deviceInfo || '').trim() || serialNumber,
          osName: String(osName || '').trim(),
          osVersion: String(osVersion || '').trim(),
          details: sanitizedDetails
        }
      },
      { new: true, runValidators: true }
    );
    if (!device) return res.status(404).json({ message: 'Device not found' });

    const beforeValue = {
      deviceInfo: beforeDevice.deviceInfo || '',
      modelName: beforeDevice.modelName || '',
      osName: beforeDevice.osName || '',
      osVersion: beforeDevice.osVersion || '',
      details: beforeDevice.details || {}
    };
    const afterValue = {
      deviceInfo: device.deviceInfo || '',
      modelName: device.modelName || '',
      osName: device.osName || '',
      osVersion: device.osVersion || '',
      details: device.details || {}
    };

    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      await DeviceChangeLog.create({
        serialNumber: device.serialNumber,
        modelName: device.modelName || device.deviceInfo || 'N/A',
        osName: device.osName || '',
        osVersion: device.osVersion || '',
        changeType: 'details_update',
        changeLabel: '상세정보 수정',
        beforeValue,
        afterValue,
        reason: '관리자 직접 수정',
        performedBy: req.user?.name || '알 수 없음'
      });
    }

    res.json({ message: 'Device details updated successfully', device });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/manage/update-status', adminAuth, async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { serialNumber, status, statusReason = '' } = req.body;

    // status 값 유효성 검사
    const validStatuses = ['active', 'repair', 'inactive'];
    const normalizedStatus = status ? status.toLowerCase() : '';
    if (!validStatuses.includes(normalizedStatus)) {
      return res.status(400).json({ message: `Invalid status value. Must be one of: ${validStatuses.join(', ')}` });
    }
    if (normalizedStatus === 'inactive' && req.user.roleLevel > 0) {
      return res.status(403).json({ message: '디바이스 비활성화는 마스터 관리자만 가능합니다.' });
    }

    const device = await Device.findOne({ serialNumber });
    if (!device) return res.status(404).json({ message: "Device not found" });

    const user = await User.findOne({ id: decoded.id });
    if (!user) return res.status(404).json({ message: "User not found" });

    // 상태 변경 기록 저장
    await DeviceStatusHistory.create({
      serialNumber: device.serialNumber,
      modelName: device.modelName,
      osName: device.osName,
      osVersion: device.osVersion,
      status: normalizedStatus,
      statusReason: statusReason,
      performedBy: user.name || 'Unknown'
    });

    device.status = normalizedStatus;
    device.statusReason = statusReason;
    await device.save();
    res.json({ message: "Device status updated successfully", device });
  } catch (error) {
    console.error('Error updating device status:', error);
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
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
    const pendingRequests = await DeviceChangeRequest.find({ status: 'pending' })
      .select('serialNumber requestType reason createdAt')
      .lean();
    const pendingBySerial = pendingRequests.reduce((acc, request) => {
      if (!acc[request.serialNumber]) acc[request.serialNumber] = [];
      acc[request.serialNumber].push({
        requestType: request.requestType,
        reason: request.reason || '',
        createdAt: request.createdAt
      });
      return acc;
    }, {});
    res.json(devices.map(device => ({
      ...device,
      pendingChangeRequests: pendingBySerial[device.serialNumber] || [],
      hasPendingChangeRequest: Boolean(pendingBySerial[device.serialNumber]?.length)
    })));
  } catch (error) {
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 대여 가능한 디바이스 목록 조회 (대여창용 - active 상태만)
router.get('/available', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    jwt.verify(token, JWT_SECRET);
    const pendingSerials = await DeviceChangeRequest.distinct('serialNumber', { status: 'pending' });
    const devices = await Device.find({
      status: 'active',
      rentedBy: null,
      pendingExternalRentalBy: null,
      serialNumber: { $nin: pendingSerials }
    }).lean();
    if (!devices || devices.length === 0) {
      return res.status(404).json({ message: "No available devices found" });
    }
    res.json(devices);
  } catch (error) {
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
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
    const { deviceId, remark = '', rentalType = 'normal' } = req.body;
    const normalizedRentalType = normalizeRentalType(rentalType);
    const normalizedRemark = String(remark || '').trim();

    const user = await User.findOne({ id: decoded.id });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.name || !user.affiliation || user.name.trim() === '' || user.affiliation.trim() === '') {
      return res.status(400).json({ message: "User name or affiliation is incomplete" });
    }

    const pendingChangeRequest = await DeviceChangeRequest.findOne({ serialNumber: deviceId, status: 'pending' }).lean();
    if (pendingChangeRequest) {
      return res.status(409).json({ message: "승인 대기 중인 디바이스 제보가 있어 대여할 수 없습니다." });
    }

    if (normalizedRentalType === 'external' && !normalizedRemark) {
      return res.status(400).json({ message: '외부대여는 사유를 반드시 입력해야 합니다.' });
    }

    const rentedAt = new Date();

    if (normalizedRentalType === 'external') {
      const device = await Device.findOneAndUpdate(
        {
          serialNumber: deviceId,
          rentedBy: null,
          pendingExternalRentalBy: null,
          status: 'active'
        },
        {
          $set: {
            pendingExternalRentalBy: { id: user.id, name: user.name, affiliation: user.affiliation },
            pendingExternalRentalAt: rentedAt,
            remark: normalizedRemark,
            rentalType: 'external',
            longTermStatus: 'pending',
            approvedBy: '',
            approvedAt: null
          }
        },
        { new: true }
      );

      if (!device) {
        const currentDevice = await Device.findOne({ serialNumber: deviceId }).lean();
        if (!currentDevice) return res.status(404).json({ message: "Device not found" });
        if (currentDevice.rentedBy) return res.status(409).json({ message: "Device already rented" });
        if (currentDevice.pendingExternalRentalBy) return res.status(409).json({ message: "외부대여 승인 대기 중인 디바이스입니다." });
        return res.status(400).json({ message: `Device is not available (${currentDevice.status}${currentDevice.statusReason ? `: ${currentDevice.statusReason}` : ''})` });
      }

      return res.json({ message: "외부대여 승인 요청이 등록되었습니다." });
    }

    const device = await Device.findOneAndUpdate(
      { serialNumber: deviceId, rentedBy: null, pendingExternalRentalBy: null, status: 'active' },
      {
        $set: {
          rentedBy: { name: user.name, affiliation: user.affiliation },
          rentedAt,
          remark: normalizedRemark,
          rentalType: normalizedRentalType,
          longTermStatus: 'none',
          approvedBy: '',
          approvedAt: null,
          pendingExternalRentalBy: null,
          pendingExternalRentalAt: null
        }
      },
      { new: true }
    );

    if (!device) {
      const currentDevice = await Device.findOne({ serialNumber: deviceId }).lean();
      if (!currentDevice) return res.status(404).json({ message: "Device not found" });
      if (currentDevice.rentedBy) return res.status(409).json({ message: "Device already rented" });
      if (currentDevice.pendingExternalRentalBy) return res.status(409).json({ message: "외부대여 승인 대기 중인 디바이스입니다." });
      return res.status(400).json({ message: `Device is not available (${currentDevice.status}${currentDevice.statusReason ? `: ${currentDevice.statusReason}` : ''})` });
    }

    const deviceInfo = {
      modelName: device.modelName,
      osName: device.osName,
      osVersion: device.osVersion
    };
    const historyData = {
      deviceId: device._id,
      serialNumber: device.serialNumber,
      userId: user.id,
      action: 'rent',
      rentalType: normalizedRentalType,
      longTermStatus: 'none',
      userDetails: { name: user.name.trim(), affiliation: user.affiliation.trim() },
      deviceInfo: deviceInfo,
      remark: normalizedRemark,
      timestamp: rentedAt
    };
    await RentalHistory.create(historyData);
    res.json({ message: "Device rented successfully" });
  } catch (error) {
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
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
    const user = await User.findOne({ id: decoded.id });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.name || !user.affiliation || user.name.trim() === '' || user.affiliation.trim() === '') {
      return res.status(400).json({ message: "User name or affiliation is incomplete" });
    }

    // status 값 유효성 검사
    const validStatuses = ['active', 'repair', 'inactive'];
    const normalizedStatus = status ? status.toLowerCase() : 'active';
    if (!validStatuses.includes(normalizedStatus)) {
      return res.status(400).json({ message: `Invalid status value. Must be one of: ${validStatuses.join(', ')}` });
    }

    const device = await Device.findOneAndUpdate(
      { serialNumber: deviceId, 'rentedBy.name': user.name },
      {
        $set: {
          rentedBy: null,
          rentedAt: null,
          rentalType: 'normal',
          longTermStatus: 'none',
          approvedBy: '',
          approvedAt: null,
          pendingExternalRentalBy: null,
          pendingExternalRentalAt: null,
          status: normalizedStatus,
          statusReason: statusReason
        }
      },
      { new: false }
    );

    if (!device) {
      const currentDevice = await Device.findOne({ serialNumber: deviceId }).lean();
      if (!currentDevice) return res.status(404).json({ message: "Device not found" });
      if (!currentDevice.rentedBy) return res.status(400).json({ message: "Device is not rented" });
      return res.status(403).json({ message: "Cannot return this device" });
    }

    console.log('Found device:', device);

    const deviceInfo = {
      modelName: device.modelName,
      osName: device.osName,
      osVersion: device.osVersion
    };
    console.log('Device info for return:', deviceInfo);
    const historyData = {
      deviceId: device._id,
      serialNumber: device.serialNumber,
      userId: user.id,
      action: 'return',
      rentalType: device.rentalType || 'normal',
      longTermStatus: device.longTermStatus || 'none',
      userDetails: { name: user.name.trim(), affiliation: user.affiliation.trim() },
      deviceInfo: deviceInfo,
      timestamp: new Date()
    };
    console.log('History data to save:', historyData);
    const historyResult = await RentalHistory.create(historyData);
    console.log('Saved history:', historyResult);

    // 상태 변경 기록 저장
    await DeviceStatusHistory.create({
      serialNumber: device.serialNumber,
      modelName: device.modelName,
      osName: device.osName,
      osVersion: device.osVersion,
      status: normalizedStatus,
      statusReason: statusReason,
      performedBy: user.name || 'Unknown'
    });

    res.json({ message: "Device returned successfully" });
  } catch (error) {
    console.error('Return error:', error);
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get('/status-history', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    jwt.verify(token, JWT_SECRET);
    const statusHistory = (await DeviceStatusHistory.find()
      .sort({ timestamp: -1 })
      .lean())
      .map((record) => ({
        ...record,
        changeType: 'status',
        changeLabel: '상태 변경',
        beforeValue: '',
        afterValue: record.status,
        reason: record.statusReason || '',
        performedBy: record.performedBy || '알 수 없음',
        timestamp: record.timestamp,
      }));

    const requestHistory = (await DeviceChangeRequest.find({ status: 'approved' })
      .sort({ reviewedAt: -1 })
      .lean())
      .map((record) => ({
        _id: record._id,
        serialNumber: record.serialNumber,
        modelName: record.modelName || 'N/A',
        osName: record.osName || '',
        osVersion: record.osVersion || '',
        status: record.requestType === 'repair_needed' ? 'repair' : 'os_change',
        statusReason: record.reviewNote || record.reason || '',
        changeType: record.requestType,
        changeLabel: record.requestType === 'os_change' ? 'OS 변경 승인' : '수리 필요 승인',
        beforeValue: record.requestType === 'os_change'
          ? `${record.currentValue?.osName || ''} ${record.currentValue?.osVersion || ''}`.trim()
          : record.currentValue?.status || '',
        afterValue: record.requestType === 'os_change'
          ? `${record.proposedValue?.osName || ''} ${record.proposedValue?.osVersion || ''}`.trim()
          : 'repair',
        reason: record.reviewNote || record.reason || '',
        performedBy: record.reviewedBy?.name || '알 수 없음',
        submittedBy: record.submittedBy?.name || '',
        timestamp: record.reviewedAt || record.updatedAt || record.createdAt,
      }));

    const directLogHistory = (await DeviceChangeLog.find()
      .sort({ timestamp: -1 })
      .lean())
      .map((record) => ({
        _id: record._id,
        serialNumber: record.serialNumber || 'SYSTEM',
        modelName: record.modelName || 'N/A',
        osName: record.osName || '',
        osVersion: record.osVersion || '',
        status: record.changeType,
        statusReason: record.reason || '',
        changeType: record.changeType,
        changeLabel: record.changeLabel,
        beforeValue: record.beforeValue,
        afterValue: record.afterValue,
        reason: record.reason || '',
        performedBy: record.performedBy || '알 수 없음',
        timestamp: record.timestamp,
      }));

    const history = [...statusHistory, ...requestHistory, ...directLogHistory]
      .filter((record) => record.timestamp)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json(history);
  } catch (error) {
    console.error('Error fetching status history:', error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
