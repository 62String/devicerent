const mongoose = require('mongoose');
const Device = require('../../models/Device');
const fs = require('fs');
const xlsx = require('xlsx');

const { initDevices } = jest.requireActual('../../server');

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue(''),
  readdirSync: jest.fn(),
  statSync: jest.fn().mockReturnValue({ mtime: new Date() }),
}));

jest.mock('xlsx', () => ({
  readFile: jest.fn(),
  utils: {
    sheet_to_json: jest.fn(),
    book_new: jest.fn().mockReturnValue({}),
    json_to_sheet: jest.fn().mockReturnValue({}),
    book_append_sheet: jest.fn(),
  },
  write: jest.fn().mockReturnValue(Buffer.from('mocked buffer')),
}));

jest.mock('../../models/User', () => ({
  findOne: jest.fn(),
}));

describe('initDevices', () => {
  let connection;

  beforeAll(async () => {
    connection = await mongoose.connect('mongodb://localhost:27017/devicerent-test', {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 60000,
    });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Device.deleteMany({});
    fs.writeFileSync.mockReset();
    fs.existsSync.mockReturnValue(true);
    fs.readdirSync.mockReturnValue(['test.xlsx']);
    xlsx.readFile.mockReturnValue({ Sheets: { Sheet1: {} }, SheetNames: ['Sheet1'] });
    xlsx.utils.sheet_to_json.mockClear();
  });

  it('should initialize devices from excel file', async () => {
    const mockDevices = [
      {
        '시리얼 번호': 'TEST001',
        '디바이스 정보': 'Test Device',
        '모델명': 'TestDevice',
        'OS 이름': 'AOS',
        'OS 버전': '14',
        '대여자': '없음',
        '대여일시': '없음',
      },
    ];
    xlsx.utils.sheet_to_json.mockReturnValue(mockDevices);
    await Device.create({
      serialNumber: 'EXISTING001',
      deviceInfo: 'Existing Device',
      osName: 'AOS',
      osVersion: '14',
      modelName: 'ExistingModel',
      status: 'active',
    });

    await initDevices(false);

    const devices = await Device.find({ serialNumber: 'TEST001' });
    expect(devices.length).toBe(1);
    expect(devices[0].serialNumber).toBe('TEST001');
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('should skip invalid devices from excel file and insert none', async () => {
    const mockInvalidDevices = [
      { '시리얼 번호': '', '디바이스 정보': 'Invalid Device', 'OS 이름': 'AOS', 'OS 버전': '14' },
    ];
    xlsx.utils.sheet_to_json.mockReturnValue(mockInvalidDevices);

    await initDevices(false);

    const devices = await Device.find();
    expect(devices.length).toBe(0);
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('should throw error if existing devices are invalid', async () => {
    await Device.create([
      {
        serialNumber: 'DUPE001',
        deviceInfo: 'Device 1',
        osName: 'AOS',
        osVersion: '14',
        modelName: 'Model1',
        status: 'active',
      },
      {
        serialNumber: 'DUPE001',
        deviceInfo: 'Device 2',
        osName: 'AOS',
        osVersion: '14',
        modelName: 'Model2',
        status: 'active',
      },
    ]);

    await expect(initDevices(false)).rejects.toThrow(/Invalid devices found/);
  });

  it('should do nothing if no excel files exist', async () => {
    fs.readdirSync.mockReturnValue([]);

    await initDevices(false);

    const devices = await Device.find();
    expect(devices.length).toBe(0);
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});