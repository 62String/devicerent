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

  // 현재 initDevices 계약: AOS/iOS 시트를 동적으로 찾고,
  // sheet_to_json은 ① 파일 선택 프로브 ② AOS 시트 ③ iOS 시트 순으로 호출됨 (②③은 헤더 행 포함)
  const HEADER_ROW = { '번호': '번호', '식별번호': '식별번호', '기기명': '기기명', 'OS버전': 'OS버전' };

  const mockExcel = (androidRows, iosRows = []) => {
    xlsx.readFile.mockReturnValue({ Sheets: { AOS: {}, iOS: {} }, SheetNames: ['AOS', 'iOS'] });
    xlsx.utils.sheet_to_json
      .mockReturnValueOnce([{ probe: true }])
      .mockReturnValueOnce([HEADER_ROW, ...androidRows])
      .mockReturnValueOnce([HEADER_ROW, ...iosRows]);
  };

  beforeEach(async () => {
    await Device.deleteMany({});
    fs.writeFileSync.mockReset();
    fs.existsSync.mockReturnValue(true);
    fs.readdirSync.mockReturnValue(['test.xlsx']);
    xlsx.utils.sheet_to_json.mockReset();
  });

  it('should initialize devices from excel file', async () => {
    mockExcel([
      { '번호': 1, '식별번호': 'TEST001', '기기명': 'Test Device', 'OS버전': '14' },
    ]);
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
    expect(devices[0].osName).toBe('Android');
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('should skip invalid devices from excel file and insert none', async () => {
    mockExcel([
      { '번호': 1, '식별번호': '', '기기명': 'Invalid Device', 'OS버전': '14' },
    ]);

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

  it('should throw if no excel files exist', async () => {
    fs.readdirSync.mockReturnValue([]);

    await expect(initDevices(false)).rejects.toThrow('No Excel files found in directory');

    const devices = await Device.find();
    expect(devices.length).toBe(0);
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});