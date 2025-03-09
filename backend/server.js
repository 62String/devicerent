require('dotenv').config();
const express = require('express');
const cors = require('cors');
const xlsx = require('xlsx');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { verifyToken } = require('./utils/auth');

const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const approveRoutes = require('./routes/admin/approve');
const usersRoutes = require('./routes/admin/users');
const Device = require('./models/Device');
const User = require('./models/User');

const app = express();

app.use(cors({
  origin: 'http://localhost:3000',
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

const excelFile = process.env.EXCEL_FILE_PATH || './device-data.xlsx';
const initDevices = async (force = false) => {
  try {
    const count = await Device.countDocuments();
    console.log('Current device count:', count);
    if (count > 0 && !force) {
      console.log('Existing devices found, skipping full initialization. Checking for updates...');
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

const PORT = process.env.PORT || 4000;

mongoose
  .connect('mongodb://localhost:27017/devicerent')
  .then(() => {
    console.log('MongoDB connected');
    return initDevices(); // MongoDB 연결 후 초기화
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
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || '비밀열쇠12345678');
    const user = await User.findOne({ id: decoded.id });
    if (!user) return res.status(404).json({ message: 'User not found' });
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