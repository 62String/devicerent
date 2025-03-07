const express = require('express');
const cors = require('cors');
const xlsx = require('xlsx');
const mongoose = require('mongoose');
const app = express();

const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const adminRoutes = require('./routes/admin');
const Device = require('./models/Device');

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

const excelFile = process.env.EXCEL_FILE_PATH || './device-data.xlsx';
const initDevices = async () => {
  try {
    const count = await Device.countDocuments();
    if (count === 0) {
      const workbook = xlsx.readFile(excelFile);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const devices = xlsx.utils.sheet_to_json(sheet);
      await Device.insertMany(devices);
      console.log('Devices initialized from Excel');
    }
  } catch (error) {
    console.error('Error initializing devices:', error);
  }
};

mongoose.connect('mongodb://localhost:27017/devicerent')
  .then(() => {
    console.log('MongoDB connected');
    initDevices();
  })
  .catch(err => console.error('MongoDB connection error:', err));

app.use('/api', authRoutes);
app.use('/api', deviceRoutes);
app.use('/api/admin', adminRoutes);

// 임시로 남겨둔 엔드포인트 (나중에 라우팅 화 가능)
app.get('/api/data', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findOne({ username: decoded.username });
    if (!user || user.isPending) return res.status(403).json({ message: "Access denied" });
    res.json({ message: "User data", data: [{ id: 1, name: "Device Data" }] });
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(403).json({ message: "Invalid token" });
  }
});

app.post('/api/sync', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = await verifyToken(token, process.env.JWT_SECRET || 'your-secret-key');
    if (!decoded.username || !(await User.findOne({ username: decoded.username, isAdmin: true }))) 
      return res.status(403).json({ message: "Admin access required" });
    let syncData = req.body || {};
    syncData = { ...syncData, id: syncData.id || 1, deviceInfo: syncData.deviceInfo || "Device123" };
    delete syncData.category;
    delete syncData.osVersion;
    delete syncData.location;
    res.json(syncData);
  } catch (err) {
    console.error('Sync error:', err);
    return res.status(403).json({ message: "Invalid token" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
