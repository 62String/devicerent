const { initDevices } = require('../../server');
const Device = require('../../models/Device');
const mongoose = require('mongoose');
const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');

describe('initDevices (Integration)', () => {
  let testConnection;

  beforeAll(async () => {
    testConnection = mongoose.createConnection('mongodb://localhost:27017/devicerent-test', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 60000
    });
    const DeviceModel = testConnection.model('Device', Device.schema);
    await DeviceModel.deleteMany({});
  }, 60000);

  afterAll(async () => {
    await testConnection.dropDatabase();
    await testConnection.close();
  });

  afterEach(async () => {
    const DeviceModel = testConnection.model('Device', Device.schema);
    await DeviceModel.deleteMany({ serialNumber: { $in: ['TEST001', 'TEST003', 'TEST004'] } });
  });

  it('should throw error if invalid devices are found', async () => {
    const DeviceModel = testConnection.model('Device', Device.schema);
    await DeviceModel.create({
      osName: 'AOS'
    });

    await expect(initDevices()).rejects.toThrow('Invalid devices found');
  });

  it('should import devices successfully from Excel file', async () => {
    const exportPath = path.join(__dirname, 'test.xlsx');
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet([
      { '시리얼 번호': 'TEST001', 'OS 이름': 'AOS', 'OS 버전': '14', '모델명': 'TestDevice' }
    ]);
    xlsx.utils.book_append_sheet(wb, ws, 'Devices');
    xlsx.writeFile(wb, exportPath);

    await initDevices(false, exportPath);
    const DeviceModel = testConnection.model('Device', Device.schema);
    const devices = await DeviceModel.find();
    expect(devices.length).toBe(1);
    expect(devices[0].serialNumber).toBe('TEST001');
    expect(devices[0].osName).toBe('AOS');

    fs.unlinkSync(exportPath);
  });

  it('should throw error if Excel file contains invalid data', async () => {
    const exportPath = path.join(__dirname, 'test.xlsx');
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet([
      { '시리얼 번호': 'TEST001', 'OS 이름': 'AOS' },
      { '시리얼 번호': '', 'OS 이름': 'AOS' },
      { '시리얼 번호': 'TEST003', 'OS 이름': 'AOS', '대여일시': 'invalid-date' },
      { '시리얼 번호': 'TEST001', 'OS 이름': 'AOS' },
      { '시리얼 번호': 'TEST004', 'OS 이름': 'AOS', 'location': 'OldField' }
    ]);
    xlsx.utils.book_append_sheet(wb, ws, 'Devices');
    xlsx.writeFile(wb, exportPath);

    await expect(initDevices(false, exportPath)).rejects.toThrow('Invalid devices found');

    fs.unlinkSync(exportPath);
  });
});