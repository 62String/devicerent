require('dotenv').config();
const express = require('express');
const cors = require('cors');
const xlsx = require('xlsx');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { verifyToken } = require('./utils/auth');
const RentalHistory = require('./models/RentalHistory'); // 누락된 모델 추가
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

const excelFile = process.env.EXCEL_FILE_PATH || './device-data.xlsx';
const initDevices = async (force = false) => {
  try {
    const count = await Device.countDocuments();
    console.log('Current device count:', count);
    if (count > 0 && !force) {
      console.log('Existing devices found, skipping full initialization. Checking for updates...');
      return;
    }
    const indexes = await mongoose.connection.db.collection('devices').indexes();
    if (indexes.some(index => index.name === 'id_1')) {
      console.log('Dropping id_1 index...');
      await mongoose.connection.db.collection('devices').dropIndex('id_1');
      console.log('id_1 index dropped successfully.');
    }
    if (count > 0 && force) {
      console.log('Forcing device initialization, deleting existing devices...');
      await Device.deleteMany({});
    }
    const workbook = xlsx.readFile(excelFile);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawDevices = xlsx.utils.sheet_to_json(sheet);
    if (!rawDevices || rawDevices.length === 0) {
      console.log('No devices found in Excel file');
      return;
    }
    const devicesToInsert = [];
    const devicesToUpdate = [];
    const invalidDevices = [];
    const existingDevices = await Device.find({}, 'serialNumber');
    const existingSerials = new Set(existingDevices.map(d => d.serialNumber));

    rawDevices.forEach((device, index) => {
      console.log(`Processing device at index ${index}:`, device);
      if (!device.SerialNumber || !device.DeviceInfo || !device.OSName) {
        invalidDevices.push({ index, device });
      } else {
        const newDevice = {
          serialNumber: device.SerialNumber,
          deviceInfo: device.DeviceInfo,
          osName: device.OSName,
          osVersion: device.OSVersion || '',
          modelName: device.ModelName || '',
          status: 'active',
          rentedBy: null,
          rentedAt: null,
        };
        if (existingSerials.has(device.SerialNumber)) {
          devicesToUpdate.push(newDevice);
        } else {
          devicesToInsert.push(newDevice);
        }
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
    if (devicesToInsert.length > 0) {
      result = await Device.insertMany(devicesToInsert, { ordered: false });
      console.log('New devices inserted:', result ? result.insertedCount : 0);
      console.log('Inserted devices:', result ? result.insertedIds : {});
    }
    if (devicesToUpdate.length > 0) {
      for (const device of devicesToUpdate) {
        await Device.updateOne({ serialNumber: device.serialNumber }, { $set: device }, { upsert: false });
      }
      console.log('Existing devices updated:', devicesToUpdate.length);
    }
    console.log('Total devices processed:', devicesToInsert.length + devicesToUpdate.length);
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

// 디바이스 초기화 API 추가
app.post('/api/admin/init-devices', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || '비밀열쇠12345678');
    const user = await User.findOne({ id: decoded.id, isAdmin: true });
    if (!user) return res.status(403).json({ message: 'Admin access required' });

    const { force } = req.body;
    await initDevices(force);
    res.json({ message: 'Device initialization completed', force });
  } catch (error) {
    console.error('Device initialization error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

const DB_RETENTION_LIMIT = 1000 * 60 * 60 * 24 * 365 * 2; // 2년 (밀리초)
const EXPORT_DIR = path.resolve(__dirname, 'exports');

if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
  console.log('Created exports directory:', EXPORT_DIR);
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

    // 익스포트 로그 저장
    await ExportHistory.create({
      timestamp: new Date(),
      filePath: `/exports/${fileName}`,
      recordCount: history.length,
      deletedCount: deleteResult.deletedCount,
      performedBy: 'system' // 자동 실행 시 system으로 설정
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
    // 초기화는 API 호출로만 실행
    console.log('Device initialization skipped. Use /api/admin/init-devices to initialize devices.');
    await exportRetentionData(); // 서버 시작 시 즉시 체크
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