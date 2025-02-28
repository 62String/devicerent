const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors()); // 프론트엔드 도메인 허용
app.use(express.json());

app.get('/api/data', (req, res) => {
  const data = {
    id: 1,
    deviceInfo: "Device123",
    category: "Game",
    osVersion: "1.0",
    location: "Tokyo"
  };
  res.json(data);
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

app.listen(4000, () => console.log('Server running on port 4000'));