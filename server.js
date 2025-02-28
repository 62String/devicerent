const express = require('express');
const app = express();

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
  let syncData = req.body;
  delete syncData.category;
  delete syncData.osVersion;
  delete syncData.location;
  res.json(syncData);
});

app.listen(3000, () => console.log('Server running on port 3000'));