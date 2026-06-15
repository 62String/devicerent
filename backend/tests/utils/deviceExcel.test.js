const xlsx = require('xlsx');
const { parseDeviceWorkbook, mapInventoryStatus, inferOsName } = require('../../utils/deviceExcel');

describe('device Excel parser', () => {
  test('parses the GameDex inventory sheet and preserves detail fields', () => {
    const workbook = xlsx.utils.book_new();
    const rows = [
      ['테스트 기기 보유 현황'],
      [],
      ['식별번호', '상태', '구분', '제조사', '기기명', '모델명', 'Chipset', 'CPU', 'GPU', 'Memory', 'Bluetooth', '화면 크기', '해상도', 'OS버전', '등록일', '확인일', '비고', 'UDID'],
      ['GD_i_001', '정상', 'Phone', 'Apple', 'iPhone 13', 'A2633', 'A15 Bionic', '6-core', '4-core', '4 GB', '5.0', '6.1"', '2532 x 1170', '18.5', '2026-03-25', '2026-03-25', 'QA device', 'sample-udid'],
    ];
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet(rows), '게임덱스260325');

    const parsed = parseDeviceWorkbook(xlsx, workbook);

    expect(parsed.sourceSheets).toEqual(['게임덱스260325']);
    expect(parsed.devices).toHaveLength(1);
    expect(parsed.devices[0]).toMatchObject({
      serialNumber: 'GD_i_001',
      modelName: 'iPhone 13',
      osName: 'iOS',
      osVersion: '18.5',
      status: 'active',
      details: {
        manufacturer: 'Apple',
        modelNumber: 'A2633',
        chipset: 'A15 Bionic',
        resolution: '2532 x 1170',
        udid: 'sample-udid',
      },
    });
  });

  test('maps source statuses conservatively', () => {
    expect(mapInventoryStatus('정상').status).toBe('active');
    expect(mapInventoryStatus('수리').status).toBe('repair');
    expect(mapInventoryStatus('폐기').status).toBe('inactive');
    expect(mapInventoryStatus('대여')).toEqual({ status: 'inactive', statusReason: '엑셀 상태: 대여' });
    expect(inferOsName('GD_A_001')).toBe('Android');
    expect(inferOsName('GD_i_001')).toBe('iOS');
  });
});
