const mongoose = require('mongoose');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const xlsx = require('xlsx');
const jwt = require('jsonwebtoken');
const { verifyToken } = require('./utils/auth');
const RentalHistory = require('./models/RentalHistory');
const ExportHistory = require('./models/ExportHistory');
const Device = require('./models/Device');
const User = require('./models/User');
const fs = require('fs');
const path = require('path');

const log = process.env.NODE_ENV === 'test' ? () => {} : console.log;

const app = express();

log('Starting backend server...');

app.use(cors({
  origin: (origin, callback) => {
    // 허용할 Origin 명시
    const allowedOrigins = ['http://192.168.0.125:3000', 'http://localhost:3000'];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

log('Loading routes...');

const authRoutes = process.env.NODE_ENV !== 'test' ? require('./routes/auth') : null;
const deviceRoutes = process.env.NODE_ENV !== 'test' ? require('./routes/devices') : null;
const usersRoutes = process.env.NODE_ENV !== 'test' ? require('./routes/admin/users') : null;

if (process.env.NODE_ENV !== 'test') {
  app.use('/api/auth', authRoutes);
  app.use('/api/devices', deviceRoutes);
  app.use('/api/admin', usersRoutes);
}

log('Setting up exports directory...');

app.use('/exports', express.static(path.resolve(__dirname, 'exports')));

const EXPORT_DIR = process.env.EXPORT_DIR || path.join(__dirname, 'exports', 'Device-list');

if (!fs.existsSync(EXPORT_DIR)) {
  try {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
    log('Created exports directory:', EXPORT_DIR);
  } catch (err) {
    console.error('Failed to create exports directory:', err);
  }
}

const initDevices = async (force = false, exportPath = null) => {
  try {
    log('Starting initDevices...');
    const devices = await Device.find();
    log('Existing devices count:', devices.length);
    const invalidDevices = [];
    const serialNumbers = new Set();

    devices.forEach((device, index) => {
      const issues = [];
      if (!device.serialNumber) issues.push('Missing serialNumber');
      if (!device.osName) issues.push('Missing osName');
      if (device.rentedAt && isNaN(new Date(device.rentedAt).getTime())) issues.push('Invalid rentedAt');
      if (serialNumbers.has(device.serialNumber)) issues.push('Duplicate serialNumber');
      else serialNumbers.add(device.serialNumber);
      if (device.location !== undefined) issues.push('Deprecated location field found');

      if (issues.length > 0) {
        invalidDevices.push({
          index,
          serialNumber: device.serialNumber || 'N/A',
          issues
        });
      }
    });

    if (invalidDevices.length > 0) {
      log('Invalid devices found:', invalidDevices);
      throw new Error(JSON.stringify({
        message: 'Invalid devices found',
        invalidDevices
      }));
    }

    if (devices.length > 0) {
      log('Existing devices found, creating backup...');
      const backupDate = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupFile = path.join(EXPORT_DIR, `backup_${backupDate}.xlsx`);
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
      log('Backup created at:', backupFile);
    }

    let workbook, rawDevices, importFilePath;
    if (exportPath && fs.existsSync(exportPath)) {
      log('Using provided export path:', exportPath);
      try {
        workbook = xlsx.readFile(exportPath);
      } catch (err) {
        log('Error reading Excel file:', err.message);
        throw new Error('Failed to read Excel file: ' + err.message);
      }
      importFilePath = exportPath;
    } else {
      log('EXPORT_DIR path:', EXPORT_DIR);
      log('Checking if EXPORT_DIR exists...');
      if (!fs.existsSync(EXPORT_DIR)) {
        log('Error: EXPORT_DIR does not exist:', EXPORT_DIR);
        throw new Error('EXPORT_DIR does not exist');
      }
      log('EXPORT_DIR exists, attempting to read files...');

      let files = [];
      let retries = 3;
      while (retries > 0) {
        try {
          files = fs.readdirSync(EXPORT_DIR);
          log('Files read successfully:', files);
          break;
        } catch (err) {
          log('Error reading directory, retrying...', err.message);
          retries -= 1;
          if (retries === 0) {
            log('Failed to read directory after retries:', err.message);
            throw new Error('Failed to read directory after retries: ' + err.message);
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const excelFiles = files.filter(file => file.toLowerCase().endsWith('.xlsx'));
      log('Excel files in EXPORT_DIR:', excelFiles);
      if (excelFiles.length === 0) {
        log('Warning: No Excel files found in directory:', EXPORT_DIR);
        try {
          const allFiles = fs.readdirSync(EXPORT_DIR);
          log('All available files in EXPORT_DIR:', allFiles);
        } catch (err) {
          log('Error listing all files in EXPORT_DIR:', err.message);
        }
        throw new Error('No Excel files found in directory');
      }

      let selectedFile = null;
      for (const file of excelFiles.sort((a, b) => {
        const aTime = fs.statSync(path.join(EXPORT_DIR, a)).mtime.getTime();
        const bTime = fs.statSync(path.join(EXPORT_DIR, b)).mtime.getTime();
        return bTime - aTime;
      })) {
        const tempPath = path.join(EXPORT_DIR, file);
        try {
          const tempWorkbook = xlsx.readFile(tempPath);
          log('Reading file:', tempPath);
          log('Sheet names:', tempWorkbook.SheetNames);
          const tempSheet = tempWorkbook.Sheets[tempWorkbook.SheetNames[0]];
          const tempRawDevices = xlsx.utils.sheet_to_json(tempSheet);
          log('Devices in file:', tempRawDevices);
          if (tempRawDevices && tempRawDevices.length > 0) {
            selectedFile = file;
            break;
          }
          log(`Skipping empty Excel file: ${tempPath}`);
        } catch (err) {
          log(`Error reading Excel file ${tempPath}:`, err.message);
        }
      }

      if (!selectedFile) {
        console.log('Error: No Excel files with data found in directory:', EXPORT_DIR);
        throw new Error('No Excel files with data found in directory');
      }

      importFilePath = path.join(EXPORT_DIR, selectedFile);
      console.log('Using latest non-empty Excel file:', importFilePath);
      workbook = xlsx.readFile(importFilePath);
    }

    log('Available sheet names:', workbook.SheetNames);

    // 시트 이름 동적으로 매핑
    let androidSheetName = workbook.SheetNames.find(name => name.toLowerCase().includes('aos'));
    let iosSheetName = workbook.SheetNames.find(name => name.toLowerCase().includes('ios'));

    if (!androidSheetName || !iosSheetName) {
      log('Error: Required sheets not found in Excel file', { androidSheetName, iosSheetName });
      throw new Error('Required sheets (AOS, iOS) not found in Excel file');
    }

    const androidSheet = workbook.Sheets[androidSheetName];
    const iosSheet = workbook.Sheets[iosSheetName];

    if (!androidSheet) {
      log('Error: Android sheet not found');
      throw new Error('Android sheet not found');
    }
    if (!iosSheet) {
      log('Error: iOS sheet not found');
      throw new Error('iOS sheet not found');
    }

    const androidDevices = xlsx.utils.sheet_to_json(androidSheet, { header: ['번호', '식별번호', '기기명', 'Chipset', 'CPU', 'GPU', 'Memory', 'Bluetooth', '화면크기', '해상도', 'OS버전'] }).slice(1).map(device => ({ ...device, sheetIndex: 0 }));
    const iosDevices = xlsx.utils.sheet_to_json(iosSheet, { header: ['번호', '식별번호', '기기명', 'Chipset', 'CPU', 'GPU', 'Memory', 'Bluetooth', '화면크기', '해상도', 'OS버전'] }).slice(1).map(device => ({ ...device, sheetIndex: 1 }));
    log('Android devices:', androidDevices);
    log('iOS devices:', iosDevices);
    rawDevices = [...androidDevices, ...iosDevices];
    log('Combined devices:', rawDevices);
    if (!rawDevices || rawDevices.length === 0) {
      log('No devices found in Excel file:', importFilePath);
      throw new Error('No devices found in Excel file');
    }

    // MongoDB에서 기존 serialNumber 목록 조회
    const existingDevices = await Device.find({}, 'serialNumber');
    const existingSerialNumbers = new Set(existingDevices.map(device => device.serialNumber));
    log('Existing serial numbers in MongoDB:', Array.from(existingSerialNumbers));

    const devicesToInsert = [];
    const invalidNewDevices = [];
    const newSerialNumbers = new Set();

    rawDevices.forEach((device, index) => {
      log(`Processing device at index ${index}:`, device);
      const issues = [];
      if (!device['식별번호']) issues.push('Missing serialNumber');
      if (device['대여일시'] && device['대여일시'] !== '없음') {
        const dateStr = device['대여일시'].replace('오후', 'PM').replace('오전', 'AM');
        if (isNaN(new Date(dateStr).getTime())) {
          issues.push('Invalid rentedAt');
        }
      }
      if (existingSerialNumbers.has(device['식별번호'])) issues.push('Duplicate serialNumber in MongoDB');
      if (newSerialNumbers.has(device['식별번호'])) issues.push('Duplicate serialNumber in Excel');
      else newSerialNumbers.add(device['식별번호']);
      if (device['location'] !== undefined) issues.push('Deprecated location field found');

      if (issues.length > 0) {
        invalidNewDevices.push({ index, serialNumber: device['식별번호'] || 'N/A', issues });
        return;
      }

      let rentedAt = null;
      if (device['대여일시'] && device['대여일시'] !== '없음') {
        const dateStr = device['대여일시'].replace('오후', 'PM').replace('오전', 'AM');
        rentedAt = new Date(dateStr);
        if (isNaN(rentedAt.getTime())) {
          rentedAt = null;
        }
      }

      const newDevice = {
        serialNumber: device['식별번호'],
        deviceInfo: device['기기명'] || 'N/A',
        osName: device.sheetIndex === 0 ? 'Android' : 'iOS',
        osVersion: device['OS버전'] || 'N/A',
        modelName: device['기기명'] || 'N/A',
        status: 'active',
        rentedBy: null,
        rentedAt: null,
        remark: '',
        specialRemark: ''
      };

      devicesToInsert.push(newDevice);
    });

    if (invalidNewDevices.length > 0) {
      log('Invalid new devices skipped:', invalidNewDevices);
    }
    if (devicesToInsert.length === 0) {
      log('No valid devices to insert');
      return;
    }

    // 기존 디바이스 삭제 (force 모드일 경우)
    if (force) {
      log('Force mode: deleting all existing devices...');
      await Device.deleteMany({});
    }

    let result;
    try {
      result = await Device.insertMany(devicesToInsert, { ordered: false });
      log('New devices inserted:', result ? result.length : 0);
      log('Inserted devices:', result ? result.map(d => d.serialNumber) : []);
    } catch (insertError) {
      console.error('Error during insert:', insertError);
      throw insertError;
    }
    log('Total devices processed:', devicesToInsert.length);

    log(`[${new Date().toISOString()}] import - File: ${importFilePath}`);
    log('Creating ExportHistory (initDevices):', {
      timestamp: new Date(),
      filePath: `/exports/${path.basename(importFilePath)}`,
      recordCount: rawDevices.length,
      deletedCount: 0,
      performedBy: 'system',
      action: 'import',
      exportType: 'device'
    });
    await ExportHistory.create({
      timestamp: new Date(),
      filePath: `/exports/${path.basename(importFilePath)}`,
      recordCount: rawDevices.length,
      deletedCount: 0,
      performedBy: 'system',
      action: 'import',
      exportType: 'device'
    });

    return result;
  } catch (error) {
    if (error.message.includes('Invalid devices found')) {
      throw error;
    }
    console.error('Error initializing devices:', error.message, error.stack);
    if (error.writeErrors) {
      console.error('Write errors:', error.writeErrors.map(e => ({
        index: e.index,
        message: e.err.errmsg,
        op: e.err.op
      })));
    }
    throw error;
  }
};

app.post('/api/admin/init-devices', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || '비밀열쇠12345678');
    const user = await User.findOne({ id: decoded.id, isAdmin: true });
    if (!user) return res.status(403).json({ message: 'Admin access required' });

    const { exportPath } = req.body;
    await initDevices(false, exportPath);
    res.json({ message: 'Device initialization completed' });
  } catch (error) {
    console.error('Device initialization error:', error);
    if (error.message.includes('Invalid devices found')) {
      res.status(400).json(JSON.parse(error.message));
    } else {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
});

app.post('/api/admin/clear-invalid-devices', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || '비밀열쇠12345678');
    const user = await User.findOne({ id: decoded.id, isAdmin: true });
    if (!user) return res.status(403).json({ message: 'Admin access required' });

    const { exportPath } = req.body;
    const devices = await Device.find();
    const invalidDevices = [];
    const serialNumbers = new Set();

    devices.forEach((device, index) => {
      const issues = [];
      if (!device.serialNumber) issues.push('Missing serialNumber');
      if (!device.osName) issues.push('Missing osName');
      if (device.rentedAt && isNaN(new Date(device.rentedAt).getTime())) issues.push('Invalid rentedAt');
      if (serialNumbers.has(device.serialNumber)) issues.push('Duplicate serialNumber');
      else serialNumbers.add(device.serialNumber);
      if (device.location !== undefined) issues.push('Deprecated location field found');

      if (issues.length > 0) {
        invalidDevices.push({
          index,
          serialNumber: device.serialNumber || 'N/A',
          issues
        });
      }
    });

    if (invalidDevices.length === 0) {
      return res.status(200).json({ message: 'No invalid devices found, proceeding with import' });
    }

    log('Deleting invalid devices:', invalidDevices);
    await Device.deleteMany({ serialNumber: { $in: invalidDevices.map(d => d.serialNumber) } });
    log('Invalid devices deleted');

    await initDevices(false, exportPath);
    res.json({ message: 'Invalid devices cleared and re-synced successfully' });
  } catch (error) {
    console.error('Clear invalid devices error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/admin/verify-data-integrity', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || '비밀열쇠12345678');
    const user = await User.findOne({ id: decoded.id, isAdmin: true });
    if (!user) return res.status(403).json({ message: 'Admin access required' });

    const devices = await Device.find();
    const issues = [];
    const serialNumbers = new Set();

    devices.forEach((device, index) => {
      const deviceIssues = [];
      if (!device.serialNumber) deviceIssues.push('Missing serialNumber');
      if (!device.osName) deviceIssues.push('Missing osName');
      if (device.rentedAt && isNaN(new Date(device.rentedAt).getTime())) deviceIssues.push('Invalid rentedAt');
      if (serialNumbers.has(device.serialNumber)) deviceIssues.push('Duplicate serialNumber');
      else serialNumbers.add(device.serialNumber);
      if (device.location !== undefined) deviceIssues.push('Deprecated location field found');

      if (deviceIssues.length > 0) {
        issues.push({
          serialNumber: device.serialNumber || 'N/A',
          issues: deviceIssues
        });
      }
    });

    if (issues.length > 0) {
      res.status(200).json({ message: 'Data integrity issues found', issues });
    } else {
      res.status(200).json({ message: 'Data integrity check passed, no issues found' });
    }
  } catch (error) {
    console.error('Data integrity check error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

const DB_RETENTION_LIMIT = 1000 * 60 * 60 * 24 * 365 * 2;
const EXPORT_DIR_SERVER = path.resolve(__dirname, 'exports');

if (!fs.existsSync(EXPORT_DIR_SERVER)) {
  try {
    fs.mkdirSync(EXPORT_DIR_SERVER, { recursive: true });
    log('Created exports directory:', EXPORT_DIR_SERVER);
  } catch (err) {
    console.error('Failed to create exports directory:', err);
  }
}

const exportRetentionData = async () => {
  try {
    const query = { timestamp: { $lte: new Date(Date.now() - DB_RETENTION_LIMIT) } };
    log('Attempting to check retention data at:', new Date().toISOString());
    log('Exporting retention data with query:', query);
    const history = await RentalHistory.find(query).sort({ timestamp: -1 }).lean();
    log('Fetched history for export:', history.length, history);

    if (history.length === 0) {
      log('No data older than 2 years found');
      return;
    }

    const historyByMonth = history.reduce((acc, record) => {
      const date = new Date(record.timestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      acc[monthKey] = acc[monthKey] || [];
      acc[monthKey].push({
        '시리얼 번호': record.serialNumber,
        '모델명': record.deviceInfo?.modelName || 'N/A',
        'OS 이름': record.deviceInfo?.osName || 'N/A',
        'OS 버전': record.deviceInfo?.osVersion || 'N/A',
        '대여자': record.userDetails?.name || 'N/A',
        '대여 시간': record.timestamp ? new Date(record.timestamp).toLocaleString() : 'N/A',
        '반납 시간': record.action === 'return' ? new Date(record.timestamp).toLocaleString() : 'N/A',
        '특이사항': record.remark || '없음'
      });
      return acc;
    }, {});

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
      log('Retention data exported to:', filePath);
    } catch (writeError) {
      console.error('File write error:', writeError);
      throw new Error('Failed to save export file');
    }

    const deleteResult = await RentalHistory.deleteMany(query);
    log('Deleted retention data result:', deleteResult);
    if (deleteResult.deletedCount > 0) {
      log(`Deleted ${deleteResult.deletedCount} records from database`);
    } else {
      log('No records deleted from database');
    }

    const deletedSerialNumbers = history.map(record => record.serialNumber);
    await Device.updateMany(
      { serialNumber: { $in: deletedSerialNumbers }, rentedAt: { $lte: new Date(Date.now() - DB_RETENTION_LIMIT) } },
      { $set: { rentedBy: null, rentedAt: null, remark: '' } }
    );
    log('Updated devices with expired rentals');

    log('Creating ExportHistory (retention):', {
      timestamp: new Date(),
      filePath: `/exports/${fileName}`,
      recordCount: history.length,
      deletedCount: deleteResult.deletedCount,
      performedBy: 'system',
      action: 'export-retention',
      exportType: 'retention'
    });
    await ExportHistory.create({
      timestamp: new Date(),
      filePath: `/exports/${fileName}`,
      recordCount: history.length,
      deletedCount: deleteResult.deletedCount,
      performedBy: 'system',
      action: 'export-retention',
      exportType: 'retention'
    });
  } catch (error) {
    console.error('Retention export error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    throw error;
  }
};

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
  log('Received /api/me request with token:', req.headers.authorization);
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    log('No token provided');
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || '비밀열쇠12345678');
    log('Decoded token:', decoded);
    const user = await User.findOne({ id: decoded.id });
    if (!user) {
      log('User not found for id:', decoded.id);
      return res.status(404).json({ message: 'User not found' });
    }
    log('User found:', user);
    res.json({
      user: {
        id: user.id,
        name: user.name,
        affiliation: user.affiliation,
        position: user.position,
        isPending: user.isPending || false,
        isAdmin: user.isAdmin || false,
      },
    });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(401).json({ message: 'Invalid token' });
  }
});

const PORT = process.env.PORT || 4000;
let interval;

log('Checking environment variables...');
log('MONGODB_URI:', process.env.MONGODB_URI);
log('PORT:', process.env.PORT);
log('NODE_ENV:', process.env.NODE_ENV);

log('Connecting to MongoDB...');

const connectWithRetry = async () => {
  let retries = 10;
  const MONGODB_URI = process.env.MONGODB_URI || `mongodb://${process.env.MONGODB_HOST}:${process.env.MONGODB_PORT}/${process.env.MONGODB_DATABASE}`;

  log('MONGODB_URI to be used:', MONGODB_URI);

  if (mongoose.connection.readyState !== 0) {
    log('Closing existing MongoDB connection before retry...');
    await mongoose.connection.close();
  }

  for (const conn of mongoose.connections) {
    if (conn.readyState !== 0) {
      log('Closing connection:', conn.host, conn.port);
      await conn.close();
    }
  }

  log('Mongoose connections before connect:', mongoose.connections.length);

  while (retries > 0) {
    try {
      log(`Attempting to connect to MongoDB with URI: ${MONGODB_URI}...`);
      const connection = await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 60000,
        connectTimeoutMS: 60000,
      });
      log('MongoDB connected successfully to:', MONGODB_URI);
      log('Connection host:', connection.connection.host);
      log('Connection port:', connection.connection.port);
      break;
    } catch (err) {
      console.error('MongoDB connection error:', err.message);
      retries -= 1;
      if (retries === 0) {
        console.error('Failed to connect to MongoDB after retries:', err);
        console.log('Waiting before restarting...');
        await new Promise(resolve => setTimeout(resolve, 30000));
        retries = 10;
      }
      console.log(`Retrying connection (${10 - retries}/10)...`);
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
  }

  mongoose.connection.on('connected', () => {
    log('Mongoose connection established');
  });

  mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    log('Mongoose connection disconnected');
  });
};

module.exports = connectWithRetry;

if (process.env.NODE_ENV !== 'test') {
  connectWithRetry()
    .then(async () => {
      const deviceCount = await Device.countDocuments();
      if (deviceCount === 0) {
        log('No devices found, initializing from Excel directory...');
        await initDevices(false);
      } else {
        log('Devices found, skipping directory initialization.');
      }
      await exportRetentionData();
      interval = setInterval(() => {
        log('Checking retention data at:', new Date().toISOString());
        exportRetentionData().catch(err => console.error('Interval execution error:', err));
      }, 5 * 60 * 1000);

      app.listen(PORT, '0.0.0.0', () => {
      log(`Server running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to connect to MongoDB after retries:', err);
      log('Continuing to retry connection indefinitely...');
      setTimeout(connectWithRetry, 30000);
    });
}

if (process.env.NODE_ENV === 'test') {
  process.on('exit', async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      await mongoose.disconnect();
    }
    if (interval) clearInterval(interval);
  });
}

module.exports = { app, initDevices, exportRetentionData };