require('dotenv').config();
const express = require('express');
const cors = require('cors');
const xlsx = require('xlsx');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { verifyToken } = require('./utils/auth');
const RentalHistory = require('./models/RentalHistory');
const ExportHistory = require('./models/ExportHistory');
const Device = require('./models/Device');
const User = require('./models/User');
const fs = require('fs');
const path = require('path');

const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const approveRoutes = require('./routes/admin/approve');
const usersRoutes = require('./routes/admin/users');

const app = express();

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 로그 미들웨어 추가
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/admin', approveRoutes);
app.use('/api/admin', usersRoutes);
app.use('/exports', express.static(path.resolve(__dirname, 'exports')));

// 디렉토리 설정
const EXPORT_DIR = 'C:\\Users\\62String\\DeviceRentalApi\\backend\\exports\\Device-list';

if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
  console.log('Created exports directory:', EXPORT_DIR);
}

const initDevices = async (force = false, exportPath = null) => {
  try {
    const count = await Device.countDocuments();
    console.log('Current device count:', count);
    if (count > 0 && !force) {
      console.log('Existing devices found, skipping full initialization. Checking for updates...');
    }
    if (count > 0 && force) {
      console.log('Forcing device initialization, creating backup...');
      const backupDate = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupFile = path.join(EXPORT_DIR, `backup_${backupDate}.xlsx`);
      const devices = await Device.find();
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.json_to_sheet(devices.map(d => ({
        '시리얼 번호': d.serialNumber,
        '디바이스 정보': d.deviceInfo || 'N/A',
        '모델명': d.modelName || 'N/A',
        'OS 이름': d.osName || 'N/A',
        'OS 버전': d.osVersion || 'N/A',
        '대여자': d.rentedBy ? `${d.rentedBy.name} (${d.rentedBy.affiliation || 'N/A'})` : '없음',
        '대여일시': d.rentedAt ? new Date(d.rentedAt).toLocaleString() : '없음'
      })));
      xlsx.utils.book_append_sheet(wb, ws, 'Devices');
      const buffer = xlsx.write(wb, { bookType: 'xlsx', type: 'buffer' });
      fs.writeFileSync(backupFile, buffer);
      console.log('Backup created at:', backupFile);
      await Device.deleteMany({});

      // 백업 로그 기록
      await ExportHistory.create({
        timestamp: new Date(),
        filePath: `/exports/backup_${backupDate}.xlsx`,
        recordCount: devices.length,
        deletedCount: 0,
        performedBy: 'system',
        action: 'export',
        exportType: 'backup' // 백업 유형 추가
      });
    }

    let workbook, sheet, rawDevices, importFilePath;
    if (exportPath && fs.existsSync(exportPath)) {
      console.log('Using provided export path:', exportPath);
      workbook = xlsx.readFile(exportPath);
      importFilePath = exportPath;
    } else {
      const files = fs.readdirSync(EXPORT_DIR).filter(file => file.endsWith('.xlsx'));
      if (files.length === 0) {
        console.log('Warning: No Excel files found in directory:', EXPORT_DIR);
        console.log('Available files:', fs.readdirSync(EXPORT_DIR));
        return;
      }

      let selectedFile = null;
      for (const file of files.sort((a, b) => {
        const aTime = fs.statSync(path.join(EXPORT_DIR, a)).mtime.getTime();
        const bTime = fs.statSync(path.join(EXPORT_DIR, b)).mtime.getTime();
        return bTime - aTime;
      })) {
        const tempPath = path.join(EXPORT_DIR, file);
        const tempWorkbook = xlsx.readFile(tempPath);
        const tempSheet = tempWorkbook.Sheets[tempWorkbook.SheetNames[0]];
        const tempRawDevices = xlsx.utils.sheet_to_json(tempSheet);
        if (tempRawDevices && tempRawDevices.length > 0) {
          selectedFile = file;
          break;
        }
        console.log(`Skipping empty Excel file: ${tempPath}`);
      }

      if (!selectedFile) {
        console.log('Error: No Excel files with data found in directory:', EXPORT_DIR);
        console.log('Available files:', files);
        return;
      }

      importFilePath = path.join(EXPORT_DIR, selectedFile);
      console.log('Using latest non-empty Excel file:', importFilePath);
      workbook = xlsx.readFile(importFilePath);
    }

    sheet = workbook.Sheets[workbook.SheetNames[0]];
    rawDevices = xlsx.utils.sheet_to_json(sheet);
    if (!rawDevices || rawDevices.length === 0) {
      console.log('No devices found in Excel file:', importFilePath);
      return;
    }

    const devicesToInsert = [];
    const devicesToUpdate = [];
    const invalidDevices = [];
    const existingDevices = await Device.find({}, 'serialNumber');
    const existingSerials = new Set(existingDevices.map(d => d.serialNumber));

    rawDevices.forEach((device, index) => {
      console.log(`Processing device at index ${index}:`, device);
      if (!device['시리얼 번호'] || !device['OS 이름']) {
        invalidDevices.push({ index, device });
        return;
      }

      // 대여일시 파싱 개선
      let rentedAt = null;
      if (device['대여일시'] && device['대여일시'] !== '없음') {
        const dateStr = device['대여일시'].replace('오후', 'PM').replace('오전', 'AM');
        rentedAt = new Date(dateStr);
        if (isNaN(rentedAt.getTime())) {
          console.log(`Warning: Invalid date format at index ${index}: ${device['대여일시']}, setting to null but proceeding`);
          rentedAt = null; // 무효한 날짜라도 디바이스 제외하지 않음
        }
      }

      const newDevice = {
        serialNumber: device['시리얼 번호'],
        deviceInfo: device['디바이스 정보'] || device['모델명'] || 'N/A',
        osName: device['OS 이름'],
        osVersion: device['OS 버전'] || '',
        modelName: device['모델명'] || '',
        status: 'active',
        rentedBy: device['대여자'] && device['대여자'] !== '없음' ? { name: device['대여자'].split(' (')[0], affiliation: device['대여자'].split(' (')[1]?.replace(')', '') || '' } : null,
        rentedAt: rentedAt, // null 허용
      };

      if (existingSerials.has(device['시리얼 번호'])) {
        devicesToUpdate.push(newDevice);
      } else {
        devicesToInsert.push(newDevice);
      }
    });

    if (invalidDevices.length > 0) {
      console.log('Invalid devices skipped:', invalidDevices);
    }
    if (devicesToInsert.length === 0 && devicesToUpdate.length === 0) {
      console.log('No valid devices to insert or update');
      return;
    }

    let result;
    try {
      if (devicesToInsert.length > 0) {
        result = await Device.insertMany(devicesToInsert, { ordered: false });
        console.log('New devices inserted:', result ? result.length : 0);
        console.log('Inserted devices:', result ? result.map(d => d.serialNumber) : []);
      }
      if (devicesToUpdate.length > 0) {
        for (const device of devicesToUpdate) {
          await Device.updateOne({ serialNumber: device.serialNumber }, { $set: device }, { upsert: false });
        }
        console.log('Existing devices updated:', devicesToUpdate.length);
      }
    } catch (insertError) {
      console.error('Error during insert/update:', insertError);
      throw insertError;
    }
    console.log('Total devices processed:', devicesToInsert.length + devicesToUpdate.length);

    // 초기화 로그 기록
    console.log(`[${new Date().toISOString()}] import - File: ${importFilePath}`);
    await ExportHistory.create({
      timestamp: new Date(),
      filePath: `/exports/${path.basename(importFilePath)}`,
      recordCount: rawDevices.length,
      deletedCount: 0,
      performedBy: 'system',
      action: 'import',
      exportType: 'device' // 디바이스 초기화 유형 추가
    });
  } catch (error) {
    console.error('Error initializing devices:', error.message, error.stack);
    if (error.writeErrors) {
      console.error('Write errors:', error.writeErrors.map(e => ({
        index: e.index,
        message: e.err.errmsg,
        op: e.err.op
      })));
    }
  }
};

// 디바이스 초기화 API
app.post('/api/admin/init-devices', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || '비밀열쇠12345678');
    const user = await User.findOne({ id: decoded.id, isAdmin: true });
    if (!user) return res.status(403).json({ message: 'Admin access required' });

    const { force, exportPath } = req.body;
    await initDevices(force, exportPath);
    res.json({ message: 'Device initialization completed', force });
  } catch (error) {
    console.error('Device initialization error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

const DB_RETENTION_LIMIT = 1000 * 60 * 60 * 24 * 365 * 2; // 2년 (밀리초)
const EXPORT_DIR_SERVER = path.resolve(__dirname, 'exports');

if (!fs.existsSync(EXPORT_DIR_SERVER)) {
  fs.mkdirSync(EXPORT_DIR_SERVER, { recursive: true });
  console.log('Created exports directory:', EXPORT_DIR_SERVER);
}

// 2년 초과 데이터 익스포트 및 삭제 로직
const exportRetentionData = async () => {
  try {
    const query = { timestamp: { $lte: new Date(Date.now() - DB_RETENTION_LIMIT) } };
    console.log('Attempting to check retention data at:', new Date().toISOString());
    console.log('Exporting retention data with query:', query);
    const history = await RentalHistory.find(query).sort({ timestamp: -1 }).lean();
    console.log('Fetched history for export:', history.length, history);

    if (history.length === 0) {
      console.log('No data older than 2 years found');
      return;
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
    const filePath = path.join(EXPORT_DIR_SERVER, fileName);
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

    // 익스포트 로그 저장
    await ExportHistory.create({
      timestamp: new Date(),
      filePath: `/exports/${fileName}`,
      recordCount: history.length,
      deletedCount: deleteResult.deletedCount,
      performedBy: 'system',
      action: 'export-retention',
      exportType: 'retention' // 리텐션 유형 추가
    });
  } catch (error) {
    console.error('Retention export error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
  }
};

const PORT = process.env.PORT || 4000;

mongoose
  .connect('mongodb://localhost:27017/devicerent')
  .then(async () => {
    console.log('MongoDB connected');
    const deviceCount = await Device.countDocuments();
    if (deviceCount === 0) {
      console.log('No devices found, initializing from Excel directory...');
      await initDevices(false);
    } else {
      console.log('Devices found, skipping directory initialization.');
    }
    await exportRetentionData();
    setInterval(() => {
      console.log('Checking retention data at:', new Date().toISOString());
      exportRetentionData().catch(err => console.error('Interval execution error:', err));
    }, 5 * 60 * 1000); // 5분 주기
  })
  .catch((err) => console.error('MongoDB connection error:', err));

app.get('/api/data', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || '비밀열쇠12345678');
    const user = await User.findOne({ id: decoded.id });
    if (!user || user.isPending)
      return res.status(403).json({ message: 'Access denied' });
    res.json({ message: 'User data', data: [{ id: 1, name: 'Device Data' }] });
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(403).json({ message: 'Invalid token' });
  }
});

app.get('/api/me', async (req, res) => {
  console.log('Received /api/me request with token:', req.headers.authorization);
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || '비밀열쇠12345678');
    console.log('Decoded token:', decoded);
    const user = await User.findOne({ id: decoded.id });
    if (!user) {
      console.log('User not found for id:', decoded.id);
      return res.status(404).json({ message: 'User not found' });
    }
    console.log('User found:', user);
    res.json({
      user: {
        id: user.id,
        name: user.name,
        affiliation: user.affiliation,
        isPending: user.isPending || false,
        isAdmin: user.isAdmin || false,
      },
    });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(401).json({ message: 'Invalid token' });
  }
});

app.post('/api/sync', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || '비밀열쇠12345678');
    if (!decoded.id || !(await User.findOne({ id: decoded.id, isAdmin: true }))) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    let syncData = req.body || {};
    syncData = { ...syncData, id: syncData.id || 1, deviceInfo: syncData.deviceInfo || 'Device123' };
    delete syncData.category;
    delete syncData.osVersion;
    delete syncData.location;
    res.json(syncData);
  } catch (err) {
    console.error('Sync error:', err);
    return res.status(403).json({ message: 'Invalid token' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;