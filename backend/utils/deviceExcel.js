const PREFERRED_SHEET_NAME = '임포트용';

const cleanValue = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\r\n/g, '\n').trim();
};

const mapInventoryStatus = (sourceStatus) => {
  const normalized = cleanValue(sourceStatus);
  if (normalized === '수리') {
    return { status: 'repair', statusReason: '기기 상태: 수리' };
  }
  if (normalized === '폐기' || normalized === '대여') {
    return { status: 'inactive', statusReason: `기기 상태: ${normalized}` };
  }
  return { status: 'active', statusReason: '' };
};

const inferOsName = (serialNumber) =>
  /^GD_i_/i.test(serialNumber) ? 'iOS' : 'Android';

const findHeaderRow = (rows) => rows.findIndex((row) =>
  row.some((value) => cleanValue(value) === '식별번호')
);

const parsePreferredSheet = (xlsx, workbook, sheetName) => {
  const worksheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: false });
  const headerIndex = findHeaderRow(rows);
  if (headerIndex < 0) throw new Error(`식별번호 헤더를 찾을 수 없습니다: ${sheetName}`);

  const headers = rows[headerIndex].map(cleanValue);
  return rows.slice(headerIndex + 1).map((row) => {
    const values = Object.fromEntries(headers.map((header, index) => [header, cleanValue(row[index])]));
    const serialNumber = values['식별번호'];
    if (!serialNumber) return null;

    const sourceStatus = values['상태'];
    const mappedStatus = mapInventoryStatus(sourceStatus);
    const deviceName = values['기기명'] || values['모델명'] || serialNumber;

    return {
      serialNumber,
      deviceInfo: deviceName,
      modelName: deviceName,
      osName: inferOsName(serialNumber),
      osVersion: values['OS버전'],
      status: mappedStatus.status,
      statusReason: mappedStatus.statusReason,
      details: {
        sourceSheet: sheetName,
        sourceStatus,
        category: values['구분'],
        manufacturer: values['제조사'],
        modelNumber: values['모델명'],
        chipset: values['Chipset'],
        cpu: values['CPU'],
        gpu: values['GPU'],
        memory: values['Memory'],
        bluetooth: values['Bluetooth'],
        screenSize: values['화면 크기'],
        resolution: values['해상도'],
        registeredAt: values['등록일'],
        checkedAt: values['확인일'],
        note: values['비고'],
        udid: values['UDID'],
      },
    };
  }).filter(Boolean);
};

const parseLegacySheet = (xlsx, workbook, sheetName, osName) => {
  const worksheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: false });
  return rows.slice(1).map((row) => {
    const serialNumber = cleanValue(row[1]);
    if (!serialNumber) return null;
    const deviceName = cleanValue(row[2]) || serialNumber;
    return {
      serialNumber,
      deviceInfo: deviceName,
      modelName: deviceName,
      osName,
      osVersion: cleanValue(row[10]),
      status: 'active',
      statusReason: '',
      details: {
        sourceSheet: sheetName,
        sourceStatus: '',
        category: '',
        manufacturer: '',
        modelNumber: '',
        chipset: cleanValue(row[3]),
        cpu: cleanValue(row[4]),
        gpu: cleanValue(row[5]),
        memory: cleanValue(row[6]),
        bluetooth: cleanValue(row[7]),
        screenSize: cleanValue(row[8]),
        resolution: cleanValue(row[9]),
        registeredAt: '',
        checkedAt: '',
        note: '',
        udid: '',
      },
    };
  }).filter(Boolean);
};

const parseDeviceWorkbook = (xlsx, workbook) => {
  const preferredSheet = workbook.SheetNames.find((name) =>
    name === PREFERRED_SHEET_NAME
  );
  if (preferredSheet) {
    return { devices: parsePreferredSheet(xlsx, workbook, preferredSheet), sourceSheets: [preferredSheet] };
  }

  const androidSheet = workbook.SheetNames.find((name) => name.toLowerCase().includes('aos'));
  const iosSheet = workbook.SheetNames.find((name) => name.toLowerCase().includes('ios'));
  if (!androidSheet || !iosSheet) throw new Error('Required sheets (게임덱스, AOS/iOS) not found in Excel file');

  return {
    devices: [
      ...parseLegacySheet(xlsx, workbook, androidSheet, 'Android'),
      ...parseLegacySheet(xlsx, workbook, iosSheet, 'iOS'),
    ],
    sourceSheets: [androidSheet, iosSheet],
  };
};

module.exports = { parseDeviceWorkbook, mapInventoryStatus, inferOsName };
