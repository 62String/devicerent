import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './utils/AuthContext';
import { getApiUrl } from './utils/api';
import { SearchIcon, XIcon } from './components/Icons';
import DeviceDetailsModal from './components/DeviceDetailsModal';
import { canOperateAdmin } from './utils/permissions';

const formatOs = (osName, osVersion) => {
  if (!osName && !osVersion) return 'N/A';
  if (!osVersion) return osName;
  if (!osName || osVersion.toLowerCase().startsWith(osName.toLowerCase())) return osVersion;
  return `${osName} ${osVersion}`;
};

const formatRentedAt = (rentedAt) => {
  if (!rentedAt) return null;
  const d = new Date(rentedAt);
  if (isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
};

const getDetail = (device, key) => device?.details?.[key] || '';

const getDeviceType = (device) => {
  const savedType = getDetail(device, 'deviceType');
  if (savedType) return savedType;
  const text = [
    getDetail(device, 'category'),
    getDetail(device, 'modelNumber'),
    device?.modelName,
    device?.deviceInfo,
  ].filter(Boolean).join(' ').toLowerCase();
  return /(ipad|tablet|tab|pad|패드|태블릿)/i.test(text) ? '패드' : '모바일';
};

const SEARCH_SCOPE_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'serial', label: '시리얼' },
  { value: 'model', label: '기기명' },
  { value: 'deviceType', label: '기기 유형' },
  { value: 'osVersion', label: 'OS 버전' },
  { value: 'chipset', label: '칩셋' },
  { value: 'memory', label: 'RAM' },
  { value: 'resolution', label: '해상도' },
  { value: 'screenSize', label: '인치' },
  { value: 'bluetooth', label: 'Bluetooth' },
  { value: 'specs', label: '스펙 전체' },
];

const OS_FILTER_OPTIONS = [
  { value: 'all', label: 'OS 전체' },
  { value: 'aos', label: 'AOS' },
  { value: 'ios', label: 'iOS' },
];

const SEARCH_FIELDS = {
  serial: ['serialNumber'],
  model: ['modelName', 'deviceInfo'],
  deviceType: ['details.deviceType'],
  osVersion: ['osVersion'],
  chipset: ['details.chipset'],
  memory: ['details.memory'],
  resolution: ['details.resolution'],
  screenSize: ['details.screenSize'],
  bluetooth: ['details.bluetooth'],
  specs: ['osVersion', 'details.deviceType', 'details.chipset', 'details.memory', 'details.resolution', 'details.screenSize', 'details.bluetooth'],
  all: [
    'serialNumber', 'modelName', 'deviceInfo', 'osName', 'osVersion',
    'details.deviceType', 'details.chipset', 'details.memory', 'details.resolution', 'details.screenSize', 'details.bluetooth'
  ],
};

const getSearchValue = (device, field) => {
  if (field === 'details.deviceType') return getDeviceType(device);
  if (field.startsWith('details.')) return getDetail(device, field.replace('details.', ''));
  return device?.[field] || '';
};

const normalizeSearchText = (value) => String(value || '')
  .toLowerCase()
  .replace(/\+/g, 'plus')
  .replace(/\s+/g, '');

const matchesSearch = (device, query, scope) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  const fields = SEARCH_FIELDS[scope] || SEARCH_FIELDS.all;
  return fields.some((field) => normalizeSearchText(getSearchValue(device, field)).includes(normalizedQuery));
};

const STATUS_LABELS = {
  active: '활성',
  repair: '수리 필요',
  inactive: '비활성/폐기',
};

const hasPendingChangeRequest = (device) => (
  Boolean(device?.hasPendingChangeRequest) || Boolean(device?.pendingChangeRequests?.length)
);

const hasPendingExternalRental = (device) => (
  Boolean(device?.pendingExternalRentalBy) ||
  (['external', 'longterm'].includes(device?.rentalType) && device?.longTermStatus === 'pending')
);

const getRentalType = (device) => {
  if (['external', 'longterm'].includes(device?.rentalType)) return 'external';
  if (device?.rentalType === 'home') return 'home';
  return 'normal';
};

const RENTAL_TYPE_META = {
  normal: { label: '일반', activeLabel: '일반대여중', className: 'badge badge-neutral' },
  home: { label: '재택', activeLabel: '재택대여중', className: 'badge badge-ok' },
  external: { label: '외부', activeLabel: '외부대여중', className: 'badge badge-warn' },
};

const isRentable = (device) => (
  device?.status === 'active' && !device?.rentedBy && !hasPendingExternalRental(device) && !hasPendingChangeRequest(device)
);

const isVisibleInRentalList = (device) => (
  device?.status !== 'inactive'
);

const getDeviceRowClass = (device) => {
  if (!device || device.status === 'active') return '';
  return `device-row-unavailable ${device.status === 'repair' ? 'device-row-repair' : ''}`.trim();
};

const getStatusBadgeClass = (status) => (
  status === 'repair' ? 'badge badge-repair' : 'badge badge-unavailable'
);

const parseFirstNumber = (value) => {
  const match = String(value || '').replace(/,/g, '').match(/[\d.]+/);
  return match ? Number(match[0]) : null;
};

const parseMemoryToMb = (value) => {
  const text = String(value || '').trim().toLowerCase();
  const number = parseFirstNumber(text);
  if (number == null) return null;
  if (text.includes('tb')) return number * 1024 * 1024;
  if (text.includes('gb')) return number * 1024;
  return number;
};

const parseResolutionPixels = (value) => {
  const numbers = String(value || '').match(/\d+/g);
  if (!numbers || numbers.length < 2) return null;
  return Number(numbers[0]) * Number(numbers[1]);
};

const getSortableValue = (device, field) => {
  if (!device) return null;
  if (field === 'serialNumber') return device.serialNumber || '';
  if (field === 'modelName') return `${device.modelName || ''} ${formatOs(device.osName, device.osVersion)}`.trim();
  if (field === 'deviceType') return getDeviceType(device);
  if (field === 'osVersion') return formatOs(device.osName, device.osVersion);
  if (field === 'memory') return parseMemoryToMb(getDetail(device, 'memory'));
  if (field === 'resolution') return parseResolutionPixels(getDetail(device, 'resolution'));
  if (field === 'screenSize') return parseFirstNumber(getDetail(device, 'screenSize'));
  if (field === 'bluetooth') return parseFirstNumber(getDetail(device, 'bluetooth'));
  if (field === 'renter') return device.rentedBy?.name || '';
  if (field === 'remark') return device.remark || '';
  if (field === 'status') return STATUS_LABELS[device.status] || device.status || '';
  if (field === 'rentedAt') return device.rentedAt ? new Date(device.rentedAt).getTime() : null;
  return device[field] ?? '';
};

const compareSortableValues = (aValue, bValue, order) => {
  const aEmpty = aValue == null || aValue === '';
  const bEmpty = bValue == null || bValue === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  if (typeof aValue === 'number' && typeof bValue === 'number') {
    return order === 'asc' ? aValue - bValue : bValue - aValue;
  }
  const compared = String(aValue).localeCompare(String(bValue), 'ko-KR', { numeric: true, sensitivity: 'base' });
  return order === 'asc' ? compared : -compared;
};

function Devices() {
  const [devices, setDevices] = useState([]);
  const [searchSerial, setSearchSerial] = useState('');
  const [searchScope, setSearchScope] = useState('all');
  const [osFilter, setOsFilter] = useState('all');
  const [viewFilter, setViewFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRemarkPrompt, setShowRemarkPrompt] = useState(false);
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showRemarkViewModal, setShowRemarkViewModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [detailDevice, setDetailDevice] = useState(null);
  const [reportDevice, setReportDevice] = useState(null);
  const [reportType, setReportType] = useState('os_change');
  const [reportOsName, setReportOsName] = useState('');
  const [reportOsVersion, setReportOsVersion] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [currentSerialNumber, setCurrentSerialNumber] = useState(null);
  const [remark, setRemark] = useState('');
  const [rentalType, setRentalType] = useState('normal');
  const [selectedRemark, setSelectedRemark] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [devicesPerPage, setDevicesPerPage] = useState(25);
  const [sortField, setSortField] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const { user } = useAuth();
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const location = useLocation();

  const apiUrl = getApiUrl();

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!token) {
      setError('No token found, please log in again');
      navigate('/login');
      return;
    }
    try {
      const response = await axios.get(`${apiUrl}/api/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDevices((response.data || []).filter(Boolean));
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to fetch devices');
      if (error.response?.status === 401) navigate('/login');
    } finally {
      setLoading(false);
    }
  }, [token, navigate, user, apiUrl]);

  useEffect(() => {
    if (!token || !user) navigate('/login');
    else fetchDevices();
  }, [fetchDevices, token, user, navigate]);

  const matchesRentalFilter = (device) => {
    if (!device) return false;
    if (viewFilter === 'available') return isRentable(device);
    if (!isVisibleInRentalList(device)) return false;
    if (viewFilter === 'rented') return !!device.rentedBy;
    if (viewFilter === 'mine') return !!user && device.rentedBy?.name === user.name;
    return true;
  };

  const matchesOsFilter = (device) => {
    if (osFilter === 'all') return true;
    const osName = String(device?.osName || '').trim().toLowerCase();
    if (osFilter === 'aos') return osName === 'android' || osName === 'aos';
    if (osFilter === 'ios') return osName === 'ios';
    return true;
  };

  const filteredAndSortedDevices = devices
    .filter(matchesRentalFilter)
    .filter(matchesOsFilter)
    .filter(device => device && matchesSearch(device, searchSerial, searchScope))
    .sort((a, b) => {
      if (!sortField) return 0;
      return compareSortableValues(getSortableValue(a, sortField), getSortableValue(b, sortField), sortOrder);
    });

  const indexOfLastDevice = currentPage * devicesPerPage;
  const indexOfFirstDevice = indexOfLastDevice - devicesPerPage;
  const currentDevices = filteredAndSortedDevices.slice(indexOfFirstDevice, indexOfLastDevice);
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedDevices.length / devicesPerPage));

  const visibleDevices = devices.filter(isVisibleInRentalList);
  const availableCount = devices.filter(isRentable).length;
  const rentedCount = visibleDevices.filter(d => d.rentedBy).length;
  const myCount = visibleDevices.filter(d => d.rentedBy && d.rentedBy.name === user?.name).length;

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortIndicator = (field) =>
    sortField === field ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : '';

  const statCardStyle = (filter, accent = 'var(--accent)') => ({
    cursor: 'pointer',
    borderColor: viewFilter === filter ? accent : 'var(--line)',
    background: viewFilter === filter ? 'var(--accent-soft)' : 'var(--surface)',
    boxShadow: viewFilter === filter ? `inset 0 0 0 1px ${accent}` : undefined,
  });

  const applyViewFilter = (filter) => {
    setViewFilter(filter);
    setCurrentPage(1);
  };

  const handleRentDevice = (serialNumber) => {
    if (!serialNumber) {
      alert('유효한 디바이스를 선택해 주세요.');
      return;
    }
    setCurrentSerialNumber(serialNumber);
    setRentalType('normal');
    setShowConfirmModal(true);
  };

  const confirmRent = () => {
    setShowConfirmModal(false);
    // 외부대여는 승인 사유가 필수이므로 곧장 입력 단계로 이동한다.
    if (rentalType === 'external') {
      setShowRemarkModal(true);
    } else {
      setShowRemarkPrompt(true);
    }
  };

  const handleRemarkPrompt = (hasRemark) => {
    setShowRemarkPrompt(false);
    if (hasRemark) {
      setShowRemarkModal(true);
    } else {
      submitRent();
    }
  };

  const submitRent = async () => {
    if (!currentSerialNumber) {
      alert('대여할 디바이스를 선택해 주세요.');
      return;
    }
    if (rentalType === 'external' && !remark.trim()) {
      setMessage('외부대여는 사유를 반드시 입력해야 합니다.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    try {
      const payload = { deviceId: currentSerialNumber, remark, rentalType };
      await axios.post(`${apiUrl}/api/devices/rent-device`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchDevices();
      setMessage(rentalType === 'external'
        ? '외부대여 승인 요청이 등록되었습니다. 승인 전까지 해당 기기는 잠금 처리됩니다.'
        : '대여가 성공적으로 완료되었습니다.');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(error.response?.data?.message || '대여 실패');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setShowRemarkModal(false);
      setRemark('');
      setRentalType('normal');
      setCurrentSerialNumber(null);
    }
  };

  const cancelRentFlow = () => {
    setShowConfirmModal(false);
    setShowRemarkPrompt(false);
    setShowRemarkModal(false);
    setRemark('');
    setRentalType('normal');
    setCurrentSerialNumber(null);
  };

  const closeRemarkModal = () => {
    cancelRentFlow();
  };

  const openReturnModal = (serialNumber) => {
    if (!serialNumber) {
      alert('유효한 디바이스를 선택해 주세요.');
      return;
    }
    setCurrentSerialNumber(serialNumber);
    setShowReturnModal(true);
  };

  const closeReturnModal = () => {
    setShowReturnModal(false);
    setCurrentSerialNumber(null);
  };

  const openStatusModal = () => {
    if (!currentSerialNumber) {
      alert('반납할 디바이스를 선택해 주세요.');
      return;
    }
    setShowReturnModal(false);
    const device = devices.find((item) => item.serialNumber === currentSerialNumber);
    setReportType('repair_needed');
    setReportOsName(device?.osName || '');
    setReportOsVersion(device?.osVersion || '');
    setReportReason('');
    setShowStatusModal(true);
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setReportType('repair_needed');
    setReportOsName('');
    setReportOsVersion('');
    setReportReason('');
    setCurrentSerialNumber(null);
  };

  const openRemarkViewModal = (device) => {
    setSelectedRemark(device.remark);
    setCurrentSerialNumber(device.serialNumber);
    setShowRemarkViewModal(true);
  };

  const closeRemarkViewModal = () => {
    setShowRemarkViewModal(false);
    setSelectedRemark('');
    setCurrentSerialNumber(null);
  };

  const openDetailModal = (device) => setDetailDevice(device);
  const closeDetailModal = () => setDetailDevice(null);

  const openReportModal = (device) => {
    setReportDevice(device);
    setReportType('os_change');
    setReportOsName(device.osName || '');
    setReportOsVersion(device.osVersion || '');
    setReportReason('');
    setShowReportModal(true);
  };

  const closeReportModal = () => {
    setShowReportModal(false);
    setReportDevice(null);
    setReportType('os_change');
    setReportOsName('');
    setReportOsVersion('');
    setReportReason('');
    setSubmittingReport(false);
  };

  const submitChangeRequest = async () => {
    if (!reportDevice) return;
    if (reportType === 'os_change' && !reportOsVersion.trim()) {
      setMessage('변경할 OS 버전을 입력해 주세요.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    if (!reportReason.trim()) {
      setMessage('제보 사유를 입력해 주세요.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setSubmittingReport(true);
    try {
      const proposedValue = reportType === 'os_change'
        ? { osName: reportOsName, osVersion: reportOsVersion }
        : { statusReason: reportReason };
      await axios.post(`${apiUrl}/api/devices/change-requests`, {
        serialNumber: reportDevice.serialNumber,
        requestType: reportType,
        proposedValue,
        reason: reportReason,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage('제보가 승인 대기 목록에 등록되었습니다.');
      setTimeout(() => setMessage(''), 3000);
      closeReportModal();
      closeDetailModal();
    } catch (error) {
      setMessage(error.response?.data?.message || '제보 등록 실패');
      setTimeout(() => setMessage(''), 3000);
      setSubmittingReport(false);
    }
  };

  const handleReturn = async (withReport = false) => {
    if (!currentSerialNumber) {
      alert('반납할 디바이스를 선택해 주세요.');
      return;
    }
    if (withReport && reportType === 'os_change' && !reportOsVersion.trim()) {
      setMessage('변경할 OS 버전을 입력해 주세요.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    if (withReport && !reportReason.trim()) {
      setMessage('제보 사유를 입력해 주세요.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      await axios.post(`${apiUrl}/api/devices/return-device`, { deviceId: currentSerialNumber }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (withReport) {
        const proposedValue = reportType === 'os_change'
          ? { osName: reportOsName, osVersion: reportOsVersion }
          : { statusReason: reportReason };
        await axios.post(`${apiUrl}/api/devices/change-requests`, {
          serialNumber: currentSerialNumber,
          requestType: reportType,
          proposedValue,
          reason: reportReason,
        }, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      await fetchDevices();
      setMessage(withReport ? '반납 완료 후 제보가 승인 대기 목록에 등록되었습니다.' : '반납이 성공적으로 완료되었습니다.');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(error.response?.data?.message || (withReport ? '반납 또는 제보 등록 실패' : '반납 실패'));
      setTimeout(() => setMessage(''), 3000);
    } finally {
      closeReturnModal();
      closeStatusModal();
    }
  };

  const resetSearch = () => {
    setSearchSerial('');
    setSearchScope('all');
    setOsFilter('all');
    setCurrentPage(1);
  };

  const resetDevicesPage = useCallback(() => {
    setSearchSerial('');
    setSearchScope('all');
    setOsFilter('all');
    setViewFilter('all');
    setCurrentPage(1);
    setSortField('');
    setSortOrder('asc');
    setMessage('');
    setShowConfirmModal(false);
    setShowRemarkPrompt(false);
    setShowRemarkModal(false);
    setShowReturnModal(false);
    setShowStatusModal(false);
    setShowRemarkViewModal(false);
    setShowReportModal(false);
    setDetailDevice(null);
    setReportDevice(null);
    setReportType('os_change');
    setReportOsName('');
    setReportOsVersion('');
    setReportReason('');
    setSubmittingReport(false);
    setCurrentSerialNumber(null);
    setRemark('');
    setRentalType('normal');
    setSelectedRemark('');
  }, []);

  useEffect(() => {
    if (location.state?.resetDevicesAt) resetDevicesPage();
  }, [location.state?.resetDevicesAt, resetDevicesPage]);

  const pageNumbers = () => {
    const pages = [];
    const maxShown = 7;
    let start = Math.max(1, currentPage - 3);
    let end = Math.min(totalPages, start + maxShown - 1);
    start = Math.max(1, end - maxShown + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div className="min-h-screen bg-paper">
      <div className="page-wrap" style={{ maxWidth: 1280 }}>
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-title">디바이스 대여</h1>
            <p className="page-sub">전체 디바이스를 검색하고 상태별로 바로 확인하세요</p>
          </div>
          {canOperateAdmin(user) && (
            <div className="flex gap-2">
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/admin')}>관리자 페이지</button>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/devices/manage')}>디바이스 관리</button>
            </div>
          )}
        </div>

        <div className="flex gap-2.5 mt-5 mb-4 flex-wrap">
          <button type="button" className="stat-card text-left" style={statCardStyle('all')} onClick={() => applyViewFilter('all')}>
            <div className="stat-card-label">전체</div>
            <div className="stat-card-value">{visibleDevices.length}</div>
          </button>
          <button
            type="button"
            className="stat-card text-left"
            style={{ ...statCardStyle('available', 'var(--ok)'), borderTop: '3px solid var(--ok)', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
            onClick={() => applyViewFilter('available')}
          >
            <div className="stat-card-label">대여 가능</div>
            <div className="stat-card-value" style={{ color: 'var(--ok)' }}>{availableCount}</div>
          </button>
          <button
            type="button"
            className="stat-card text-left"
            style={{ ...statCardStyle('rented', 'var(--warn)'), borderTop: '3px solid var(--warn)', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
            onClick={() => applyViewFilter('rented')}
          >
            <div className="stat-card-label">대여중</div>
            <div className="stat-card-value" style={{ color: 'var(--warn)' }}>{rentedCount}</div>
          </button>
          <button type="button" className="stat-card text-left" style={statCardStyle('mine')} onClick={() => applyViewFilter('mine')}>
            <div className="stat-card-label">내 대여</div>
            <div className="stat-card-value" style={{ color: 'var(--accent)' }}>{myCount}</div>
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {message && (
          <div className={`alert ${message.includes('실패') ? 'alert-error' : 'alert-success'}`}>{message}</div>
        )}

        <div className="flex gap-2 mb-4 flex-wrap items-center">
          <div className="relative flex-1 min-w-[220px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-hint pointer-events-none">
              <SearchIcon size={14} />
            </span>
            <input
              type="text"
              value={searchSerial}
              onChange={(e) => { setSearchSerial(e.target.value); setCurrentPage(1); }}
              onKeyDown={(e) => e.key === 'Enter' && setCurrentPage(1)}
              placeholder={
                searchScope === 'all' ? '시리얼, 기기명, 유형, OS, 칩셋, RAM, 해상도 검색' :
                `${SEARCH_SCOPE_OPTIONS.find(option => option.value === searchScope)?.label || '검색어'} 검색`
              }
              className="input w-full pl-9"
            />
          </div>
          <select
            value={osFilter}
            onChange={(e) => { setOsFilter(e.target.value); setCurrentPage(1); }}
            className="input"
            aria-label="OS 필터"
          >
            {OS_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={searchScope}
            onChange={(e) => { setSearchScope(e.target.value); setCurrentPage(1); }}
            className="input"
            aria-label="검색범위"
          >
            {SEARCH_SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button onClick={resetSearch} className="btn btn-outline">검색 초기화</button>
        </div>

        {loading ? (
          <div className="card p-10 text-center text-sub text-sm">디바이스 목록을 불러오는 중...</div>
        ) : filteredAndSortedDevices.length > 0 ? (
          <>
            <div className="card overflow-x-auto">
              <table className="table-note" style={{ tableLayout: 'fixed', minWidth: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: 58 }} className="cursor-pointer select-none" onClick={() => handleSort('serialNumber')}>
                      시리얼{sortIndicator('serialNumber')}
                    </th>
                    <th style={{ width: 132 }} className="cursor-pointer select-none" onClick={() => handleSort('modelName')}>
                      디바이스 / OS{sortIndicator('modelName')}
                    </th>
                    <th style={{ width: 46 }} className="cursor-pointer select-none" onClick={() => handleSort('deviceType')}>
                      유형{sortIndicator('deviceType')}
                    </th>
                    <th style={{ width: 50 }} className="cursor-pointer select-none" onClick={() => handleSort('memory')}>
                      RAM{sortIndicator('memory')}
                    </th>
                    <th style={{ width: 82 }} className="cursor-pointer select-none" onClick={() => handleSort('resolution')}>
                      해상도{sortIndicator('resolution')}
                    </th>
                    <th style={{ width: 44 }} className="cursor-pointer select-none" onClick={() => handleSort('screenSize')}>
                      인치{sortIndicator('screenSize')}
                    </th>
                    <th style={{ width: 54 }} className="cursor-pointer select-none" onClick={() => handleSort('bluetooth')}>
                      BT{sortIndicator('bluetooth')}
                    </th>
                    <th style={{ width: 76 }} className="cursor-pointer select-none" onClick={() => handleSort('renter')}>
                      대여자{sortIndicator('renter')}
                    </th>
                    <th style={{ width: 72 }} className="cursor-pointer select-none" onClick={() => handleSort('rentedAt')}>
                      대여일시{sortIndicator('rentedAt')}
                    </th>
                    <th style={{ width: 94 }} className="cursor-pointer select-none" onClick={() => handleSort('remark')}>
                      특이사항{sortIndicator('remark')}
                    </th>
                    <th style={{ width: 82 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {currentDevices.map(device => {
                    const rented = formatRentedAt(device.rentedAt);
                    const pendingExternal = hasPendingExternalRental(device);
                    const pendingApplicant = device.pendingExternalRentalBy;
                    const pendingAt = formatRentedAt(device.pendingExternalRentalAt);
                    const isMine = user && device.rentedBy && device.rentedBy.name === user.name;
                    const details = device.details || {};
                    const rentalMeta = RENTAL_TYPE_META[getRentalType(device)] || RENTAL_TYPE_META.normal;
                    return (
                      <tr key={device.serialNumber} className={getDeviceRowClass(device)}>
                        <td className="td-mono">{device.serialNumber || 'N/A'}</td>
                        <td>
                          <div className="cell-main truncate" title={device.modelName || 'N/A'}>
                            {device.modelName || 'N/A'}
                          </div>
                          <div className="cell-sub">{formatOs(device.osName, device.osVersion)}</div>
                        </td>
                        <td className="td-sub truncate" title={getDeviceType(device)}>
                          {getDeviceType(device)}
                        </td>
                        <td className="td-sub truncate" title={details.memory || ''}>
                          {details.memory || <span className="td-hint">—</span>}
                        </td>
                        <td className="td-sub truncate" title={details.resolution || ''}>
                          {details.resolution || <span className="td-hint">—</span>}
                        </td>
                        <td className="td-sub truncate" title={details.screenSize || ''}>
                          {details.screenSize || <span className="td-hint">—</span>}
                        </td>
                        <td className="td-sub truncate" title={details.bluetooth || ''}>
                          {details.bluetooth || <span className="td-hint">—</span>}
                        </td>
                        <td>
                          {device.rentedBy ? (
                            <>
                              <div className="cell-main">{device.rentedBy.name}</div>
                              <div className="cell-sub">{device.rentedBy.affiliation || 'N/A'}</div>
                            </>
                          ) : pendingExternal && pendingApplicant ? (
                            <>
                              <div className="cell-main">{pendingApplicant.name}</div>
                              <div className="cell-sub">{pendingApplicant.affiliation || 'N/A'}</div>
                            </>
                          ) : (
                            <span className="td-hint">—</span>
                          )}
                        </td>
                        <td>
                          {rented ? (
                            <>
                              <div className="td-sub">{rented.date}</div>
                              <div className="cell-sub">{rented.time}</div>
                            </>
                          ) : pendingAt ? (
                            <>
                              <div className="td-sub">{pendingAt.date}</div>
                              <div className="cell-sub">{pendingAt.time}</div>
                            </>
                          ) : (
                            <span className="td-hint">—</span>
                          )}
                        </td>
                        <td>
                          {(device.rentedBy || pendingExternal) && device.remark ? (
                            <button
                              type="button"
                              className="remark-preview w-full"
                              title="클릭하여 전체 보기"
                              onClick={() => openRemarkViewModal(device)}
                            >
                              {device.remark}
                            </button>
                          ) : (
                            <span className="td-hint">—</span>
                          )}
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <button
                            type="button"
                            className="icon-btn mr-2"
                            style={{ width: 28, height: 28, borderRadius: '50%', fontWeight: 700, fontFamily: 'serif' }}
                            aria-label={`${device.serialNumber} 상세 정보`}
                            title="상세 정보"
                            onClick={() => openDetailModal(device)}
                          >i</button>
                          {device.rentedBy ? (
                            isMine ? (
                              <button onClick={() => openReturnModal(device.serialNumber)} className="btn btn-accent-outline btn-sm">반납</button>
                            ) : (
                              <span className={rentalMeta.className}>{rentalMeta.activeLabel}</span>
                            )
                          ) : pendingExternal ? (
                            <span className="badge badge-warn">외부 승인대기</span>
                          ) : hasPendingChangeRequest(device) ? (
                            <span className="badge badge-warn">제보 승인대기</span>
                          ) : isRentable(device) ? (
                            <button onClick={() => handleRentDevice(device.serialNumber)} className="btn btn-primary btn-sm">대여</button>
                          ) : (
                            <span className={getStatusBadgeClass(device.status)}>{STATUS_LABELS[device.status] || '대여불가'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
              <span className="text-xs text-hint">
                총 {filteredAndSortedDevices.length}개 중 {indexOfFirstDevice + 1}–{Math.min(indexOfLastDevice, filteredAndSortedDevices.length)}
              </span>
              <div className="flex gap-1.5">
                <button
                  className="pg-btn"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  aria-label="이전 페이지"
                >
                  ‹
                </button>
                {pageNumbers().map(n => (
                  <button
                    key={n}
                    className={`pg-btn ${currentPage === n ? 'pg-btn-active' : ''}`}
                    onClick={() => setCurrentPage(n)}
                  >
                    {n}
                  </button>
                ))}
                <button
                  className="pg-btn"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  aria-label="다음 페이지"
                >
                  ›
                </button>
              </div>
              <label className="text-xs text-hint flex items-center gap-1.5">
                페이지당
                <select
                  className="input"
                  style={{ padding: '3px 8px', fontSize: 12 }}
                  value={devicesPerPage}
                  onChange={(e) => { setDevicesPerPage(Number(e.target.value)); setCurrentPage(1); }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
            </div>
          </>
        ) : (
          <div className="card p-10 text-center text-sub text-sm">표시할 디바이스가 없습니다.</div>
        )}

        {detailDevice && <DeviceDetailsModal device={detailDevice} onClose={closeDetailModal} onReport={openReportModal} />}

        {showReportModal && reportDevice && (
          <div className="modal-overlay">
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <div className="modal-title">디바이스 정보 제보</div>
                  <div className="text-xs text-sub mt-0.5">
                    <span className="td-mono">{reportDevice.serialNumber}</span> · {reportDevice.modelName || reportDevice.deviceInfo || 'N/A'}
                  </div>
                </div>
                <button className="icon-btn" aria-label="닫기" onClick={closeReportModal}><XIcon size={14} /></button>
              </div>
              <div className="modal-body">
                <label className="field-label">제보 유형</label>
                <div className="flex gap-2 mb-3">
                  {[['os_change', 'OS 변경'], ['repair_needed', '수리 필요']].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setReportType(value)}
                      className={`btn btn-sm flex-1 ${reportType === value ? 'btn-ink' : 'btn-outline'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {reportType === 'os_change' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="field-label">OS 이름</label>
                      <input
                        value={reportOsName}
                        onChange={(e) => setReportOsName(e.target.value)}
                        className="input w-full"
                        placeholder="Android / iOS"
                      />
                    </div>
                    <div>
                      <label className="field-label">변경할 OS 버전</label>
                      <input
                        value={reportOsVersion}
                        onChange={(e) => setReportOsVersion(e.target.value)}
                        className="input w-full"
                        placeholder="예) Android 15.0"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-warn" style={{ fontSize: 12 }}>
                    수리 필요 제보는 관리자 승인 후 기기 상태가 수리 필요로 변경됩니다.
                  </div>
                )}

                <label className="field-label">제보 사유</label>
                <textarea
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="input w-full resize-none"
                  rows={4}
                  placeholder={reportType === 'os_change'
                    ? '예) 실제 기기 설정에서 Android 15.0으로 확인됨'
                    : '예) 화면 터치 불량 / 충전 불량 / 파손 확인'}
                />
              </div>
              <div className="modal-foot">
                <button onClick={closeReportModal} className="btn btn-outline">취소</button>
                <button onClick={submitChangeRequest} className="btn btn-primary" disabled={submittingReport}>
                  {submittingReport ? '등록 중...' : '승인 요청'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showConfirmModal && (
          <div className="modal-overlay">
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <div className="modal-title">대여 확인</div>
                  <div className="text-xs text-sub mt-0.5">
                    <span className="td-mono">{currentSerialNumber}</span> 디바이스를 대여하시겠습니까?
                  </div>
                </div>
                <button className="icon-btn" aria-label="닫기" onClick={cancelRentFlow}><XIcon size={14} /></button>
              </div>
              <div className="modal-body">
                <label className="field-label">대여 유형</label>
                <div className="flex gap-2">
                  {[['normal', '일반'], ['external', '외부'], ['home', '재택']].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setRentalType(val)}
                      className="flex-1 text-center"
                      style={{
                        fontSize: 13, fontWeight: 500, borderRadius: 8, padding: '9px 0', cursor: 'pointer',
                        border: '1px solid', borderColor: rentalType === val ? 'var(--accent)' : 'var(--line)',
                        background: rentalType === val ? 'var(--accent-soft)' : 'var(--surface)',
                        color: rentalType === val ? 'var(--accent)' : 'var(--sub)',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {rentalType === 'external' && (
                  <div className="alert alert-warn mt-2.5" style={{ marginBottom: 0, fontSize: 12 }}>
                    외부대여는 관리자 승인 전까지 대여 처리되지 않으며, 해당 기기는 승인 대기 상태로 잠금 처리됩니다.
                  </div>
                )}
              </div>
              <div className="modal-foot">
                <button onClick={cancelRentFlow} className="btn btn-outline">취소</button>
                <button onClick={confirmRent} className="btn btn-primary">{rentalType === 'external' ? '승인 요청' : '대여하기'}</button>
              </div>
            </div>
          </div>
        )}

        {showRemarkPrompt && (
          <div className="modal-overlay">
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div className="modal-title">특이사항 등록</div>
                <button className="icon-btn" aria-label="닫기" onClick={cancelRentFlow}><XIcon size={14} /></button>
              </div>
              <div className="modal-body">
                기기 상태 등 기록해둘 특이사항이 있나요?
              </div>
              <div className="modal-foot">
                <button onClick={cancelRentFlow} className="btn btn-outline">취소</button>
                <button onClick={() => handleRemarkPrompt(false)} className="btn btn-outline">없음 — 바로 대여</button>
                <button onClick={() => handleRemarkPrompt(true)} className="btn btn-primary">특이사항 입력</button>
              </div>
            </div>
          </div>
        )}

        {showRemarkModal && (
          <div className="modal-overlay">
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <div className="modal-title">{rentalType === 'external' ? '외부대여 사유 입력' : '특이사항 입력'}</div>
                  <div className="text-xs text-sub mt-0.5"><span className="td-mono">{currentSerialNumber}</span></div>
                </div>
                <button className="icon-btn" aria-label="닫기" onClick={closeRemarkModal}><XIcon size={14} /></button>
              </div>
              <div className="modal-body">
                {rentalType === 'external' && (
                  <div className="alert alert-warn" style={{ fontSize: 12 }}>
                    외부대여는 사유 입력과 관리자 승인이 필수입니다. 승인 전에는 대여중으로 확정되지 않습니다.
                  </div>
                )}
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder={rentalType === 'external'
                    ? '예) 외부 회의/고객사 방문 중 테스트용으로 반출'
                    : '예) 액정 좌측 상단 미세 기스, 케이스 동봉'}
                  className="input w-full resize-none"
                  rows={4}
                />
              </div>
              <div className="modal-foot">
                <button onClick={closeRemarkModal} className="btn btn-outline">취소</button>
                <button
                  onClick={() => submitRent()}
                  className="btn btn-primary"
                  disabled={rentalType === 'external' && !remark.trim()}
                >
                  {rentalType === 'external' ? '승인 요청' : '대여하기'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showReturnModal && (
          <div className="modal-overlay" onClick={closeReturnModal}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <div className="modal-title">반납 확인</div>
                  <div className="text-xs text-sub mt-0.5">
                    <span className="td-mono">{currentSerialNumber}</span> 디바이스를 반납하시겠습니까?
                  </div>
                </div>
                <button className="icon-btn" aria-label="닫기" onClick={closeReturnModal}><XIcon size={14} /></button>
              </div>
              <div className="modal-body text-sub">
                기기 상태나 OS 정보가 실제와 다르면 "제보와 함께 반납"을 선택하세요.
                반납은 즉시 처리되고, 제보는 관리자 승인 대기로 등록됩니다.
              </div>
              <div className="modal-foot">
                <button onClick={openStatusModal} className="btn btn-outline">제보와 함께 반납</button>
                <button onClick={() => handleReturn(false)} className="btn btn-primary">반납하기</button>
              </div>
            </div>
          </div>
        )}

        {showStatusModal && (
          <div className="modal-overlay">
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <div className="modal-title">기기 상태 제보와 함께 반납</div>
                  <div className="text-xs text-sub mt-0.5"><span className="td-mono">{currentSerialNumber}</span></div>
                </div>
                <button className="icon-btn" aria-label="닫기" onClick={closeStatusModal}><XIcon size={14} /></button>
              </div>
              <div className="modal-body space-y-3">
                <div className="text-sm text-sub">
                  반납은 즉시 완료되고, 아래 제보 내용은 관리자가 승인한 뒤 기기 정보에 반영됩니다.
                </div>

                <div>
                  <label className="field-label">제보 유형</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setReportType('repair_needed')}
                      className={`btn ${reportType === 'repair_needed' ? 'btn-primary' : 'btn-outline'}`}
                    >
                      수리 필요
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportType('os_change')}
                      className={`btn ${reportType === 'os_change' ? 'btn-primary' : 'btn-outline'}`}
                    >
                      OS 변경
                    </button>
                  </div>
                </div>

                {reportType === 'os_change' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="field-label">OS</label>
                      <input
                        value={reportOsName}
                        onChange={(e) => setReportOsName(e.target.value)}
                        placeholder="Android / iOS"
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="field-label">OS 버전</label>
                      <input
                        value={reportOsVersion}
                        onChange={(e) => setReportOsVersion(e.target.value)}
                        placeholder="예: 15.0"
                        className="input w-full"
                      />
                    </div>
                  </div>
                )}

                <label className="field-label">제보 사유</label>
                <textarea
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder={reportType === 'os_change'
                    ? '예: OS를 업데이트해서 실제 버전이 변경되었습니다.'
                    : '예: 충전 불량, 화면 파손, 버튼 고장 등 수리가 필요한 내용을 입력하세요.'}
                  className="input w-full resize-none"
                  rows={3}
                />
              </div>
              <div className="modal-foot">
                <button onClick={closeStatusModal} className="btn btn-outline">취소</button>
                <button onClick={() => handleReturn(true)} className="btn btn-primary">반납 + 제보 등록</button>
              </div>
            </div>
          </div>
        )}

        {showRemarkViewModal && (
          <div className="modal-overlay" onClick={closeRemarkViewModal}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <div className="modal-title">특이사항</div>
                  <div className="text-xs text-sub mt-0.5"><span className="td-mono">{currentSerialNumber}</span></div>
                </div>
                <button className="icon-btn" aria-label="닫기" onClick={closeRemarkViewModal}><XIcon size={14} /></button>
              </div>
              <div className="modal-body">
                <div className="modal-note">{selectedRemark}</div>
              </div>
              <div className="modal-foot">
                <button onClick={closeRemarkViewModal} className="btn btn-outline">닫기</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Devices;
