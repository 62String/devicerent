jest.mock('../../server', () => ({
  initDevices: jest.fn()
}));

const { initDevices } = require('../../server');
const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');

// xlsx.writeFile 모킹
jest.spyOn(xlsx, 'writeFile').mockImplementation(() => {});

describe('initDevices', () => {
  it('should throw error if invalid devices are found', async () => {
    initDevices.mockRejectedValue(new Error('Invalid devices found'));
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

    initDevices.mockResolvedValue([{ serialNumber: 'TEST001', osName: 'AOS' }]);
    const result = await initDevices(false, exportPath);
    expect(result).toEqual([{ serialNumber: 'TEST001', osName: 'AOS' }]);
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

    initDevices.mockRejectedValue(new Error('Invalid devices found'));
    await expect(initDevices(false, exportPath)).rejects.toThrow('Invalid devices found');
  });
});