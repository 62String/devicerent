import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './utils/AuthContext';
import { getApiUrl } from './utils/api';
import { SearchIcon, XIcon } from './components/Icons';
import DeviceDetailsModal from './components/DeviceDetailsModal';

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

function Devices() {
  const [devices, setDevices] = useState([]);
  const [filteredDevices, setFilteredDevices] = useState([]);
  const [searchSerial, setSearchSerial] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRemarkPrompt, setShowRemarkPrompt] = useState(false);
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showRemarkViewModal, setShowRemarkViewModal] = useState(false);
  const [detailDevice, setDetailDevice] = useState(null);
  const [currentSerialNumber, setCurrentSerialNumber] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('active');
  const [statusReason, setStatusReason] = useState('');
  const [remark, setRemark] = useState('');
  const [rentalType, setRentalType] = useState('normal');
  const [selectedRemark, setSelectedRemark] = useState('');
  const [showAllDevices, setShowAllDevices] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [devicesPerPage, setDevicesPerPage] = useState(25);
  const [sortField, setSortField] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const { user } = useAuth();
  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  const apiUrl = getApiUrl();

  // 기본 표시 = 대여 가능한 디바이스만 (대여중인 건 '내 디바이스'/'모든 디바이스 보기'로 확인)
  const availableOnly = (list) => list.filter(device => device && !device.rentedBy);

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
      const activeDevices = (response.data || []).filter(device => device && device.status === 'active');
      setDevices(activeDevices);
      setFilteredDevices(availableOnly(activeDevices));
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

  const filteredAndSortedDevices = filteredDevices
    .filter(device =>
      device && device.serialNumber.toLowerCase().includes(searchSerial.toLowerCase())
    )
    .sort((a, b) => {
      if (!sortField) return 0;
      let aValue = a[sortField] || '';
      let bValue = b[sortField] || '';
      if (sortField === 'rentedAt') {
        aValue = a.rentedAt ? new Date(a.rentedAt).getTime() : 0;
        bValue = b.rentedAt ? new Date(b.rentedAt).getTime() : 0;
      }
      if (aValue == null) return sortOrder === 'asc' ? 1 : -1;
      if (bValue == null) return sortOrder === 'asc' ? -1 : 1;
      return sortOrder === 'asc' ? (aValue > bValue ? 1 : -1) : (bValue > aValue ? 1 : -1);
    });

  const indexOfLastDevice = currentPage * devicesPerPage;
  const indexOfFirstDevice = indexOfLastDevice - devicesPerPage;
  const currentDevices = filteredAndSortedDevices.slice(indexOfFirstDevice, indexOfLastDevice);
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedDevices.length / devicesPerPage));

  const availableCount = devices.filter(d => !d.rentedBy).length;
  const rentedCount = devices.filter(d => d.rentedBy).length;
  const myCount = devices.filter(d => d.rentedBy && d.rentedBy.name === user?.name).length;

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

  const toggleShowAllDevices = () => {
    setShowAllDevices(prev => !prev);
    if (!showAllDevices) {
      setFilteredDevices(devices);
    } else {
      setFilteredDevices(availableOnly(devices));
    }
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
    // 장기대여는 사유가 필요하므로 곧장 입력 단계로, 일반대여는 특이사항 여부부터 확인
    if (rentalType === 'longterm') {
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
    try {
      const payload = { deviceId: currentSerialNumber, remark, rentalType };
      await axios.post(`${apiUrl}/api/devices/rent-device`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchDevices();
      setMessage(rentalType === 'longterm'
        ? '장기대여 승인 요청이 등록되었습니다. 팀장 승인 후 확정됩니다.'
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

  const closeRemarkModal = () => {
    setShowRemarkModal(false);
    setRemark('');
    setRentalType('normal');
    setCurrentSerialNumber(null);
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
    setShowStatusModal(true);
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setSelectedStatus('active');
    setStatusReason('');
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

  const handleReturn = async (withStatusChange = false) => {
    if (!currentSerialNumber) {
      alert('반납할 디바이스를 선택해 주세요.');
      return;
    }
    try {
      const payload = withStatusChange
        ? { deviceId: currentSerialNumber, status: selectedStatus, statusReason }
        : { deviceId: currentSerialNumber };
      await axios.post(`${apiUrl}/api/devices/return-device`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchDevices();
      setMessage('반납이 성공적으로 완료되었습니다.');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(error.response?.data?.message || '반납 실패');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      closeReturnModal();
      closeStatusModal();
    }
  };

  const resetSearch = () => {
    setSearchSerial('');
    if (showAllDevices) {
      setFilteredDevices(devices);
    } else {
      setFilteredDevices(availableOnly(devices));
    }
    setCurrentPage(1);
  };

  const showMyDevices = () => {
    if (!user) return;
    const myDevices = devices.filter(device =>
      device && device.rentedBy && device.rentedBy.name === user.name
    );
    setFilteredDevices(myDevices);
    setCurrentPage(1);
  };

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
      <div className="page-wrap">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-title">디바이스 대여</h1>
            <p className="page-sub">사용 가능한 디바이스를 검색하고 바로 대여하세요</p>
          </div>
          {user?.isAdmin && (
            <div className="flex gap-2">
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/admin')}>관리자 페이지</button>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/devices/manage')}>디바이스 관리</button>
            </div>
          )}
        </div>

        <div className="flex gap-2.5 mt-5 mb-4 flex-wrap">
          <div className="stat-card">
            <div className="stat-card-label">전체</div>
            <div className="stat-card-value">{devices.length}</div>
          </div>
          <div className="stat-card" style={{ borderTop: '3px solid var(--ok)', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
            <div className="stat-card-label">대여 가능</div>
            <div className="stat-card-value" style={{ color: 'var(--ok)' }}>{availableCount}</div>
          </div>
          <div className="stat-card" style={{ borderTop: '3px solid var(--warn)', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
            <div className="stat-card-label">대여중</div>
            <div className="stat-card-value" style={{ color: 'var(--warn)' }}>{rentedCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">내 대여</div>
            <div className="stat-card-value" style={{ color: 'var(--accent)' }}>{myCount}</div>
          </div>
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
              placeholder="시리얼 번호 검색"
              className="input w-full pl-9"
            />
          </div>
          <button onClick={resetSearch} className="btn btn-outline">검색 초기화</button>
          <button onClick={showMyDevices} className="btn btn-outline">내 디바이스</button>
          <button onClick={toggleShowAllDevices} className={`btn ${showAllDevices ? 'btn-ink' : 'btn-outline'}`}>
            {showAllDevices ? '기본 보기' : '모든 디바이스 보기'}
          </button>
        </div>

        {loading ? (
          <div className="card p-10 text-center text-sub text-sm">디바이스 목록을 불러오는 중...</div>
        ) : filteredAndSortedDevices.length > 0 ? (
          <>
            <div className="card overflow-x-auto">
              <table className="table-note" style={{ tableLayout: 'fixed', minWidth: 720 }}>
                <thead>
                  <tr>
                    <th style={{ width: 96 }} className="cursor-pointer select-none" onClick={() => handleSort('serialNumber')}>
                      시리얼{sortIndicator('serialNumber')}
                    </th>
                    <th style={{ width: 190 }} className="cursor-pointer select-none" onClick={() => handleSort('modelName')}>
                      디바이스 / OS{sortIndicator('modelName')}
                    </th>
                    <th style={{ width: 120 }}>대여자</th>
                    <th style={{ width: 100 }} className="cursor-pointer select-none" onClick={() => handleSort('rentedAt')}>
                      대여일시{sortIndicator('rentedAt')}
                    </th>
                    <th>특이사항</th>
                    <th style={{ width: 116 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {currentDevices.map(device => {
                    const rented = formatRentedAt(device.rentedAt);
                    const isMine = user && device.rentedBy && device.rentedBy.name === user.name;
                    return (
                      <tr key={device.serialNumber}>
                        <td className="td-mono">{device.serialNumber || 'N/A'}</td>
                        <td>
                          <div className="cell-main truncate" title={device.modelName || 'N/A'}>
                            {device.modelName || 'N/A'}
                          </div>
                          <div className="cell-sub">{formatOs(device.osName, device.osVersion)}</div>
                        </td>
                        <td>
                          {device.rentedBy ? (
                            <>
                              <div className="cell-main">{device.rentedBy.name}</div>
                              <div className="cell-sub">{device.rentedBy.affiliation || 'N/A'}</div>
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
                          ) : (
                            <span className="td-hint">—</span>
                          )}
                        </td>
                        <td>
                          {device.rentedBy && device.remark ? (
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
                        <td className="text-right">
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
                              <span className="badge badge-warn">대여중</span>
                            )
                          ) : (
                            <button onClick={() => handleRentDevice(device.serialNumber)} className="btn btn-primary btn-sm">대여</button>
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

        {detailDevice && <DeviceDetailsModal device={detailDevice} onClose={closeDetailModal} />}

        {showConfirmModal && (
          <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <div className="modal-title">대여 확인</div>
                  <div className="text-xs text-sub mt-0.5">
                    <span className="td-mono">{currentSerialNumber}</span> 디바이스를 대여하시겠습니까?
                  </div>
                </div>
                <button className="icon-btn" aria-label="닫기" onClick={() => setShowConfirmModal(false)}><XIcon size={14} /></button>
              </div>
              <div className="modal-body">
                <label className="field-label">대여 유형</label>
                <div className="flex gap-2">
                  {[['normal', '일반 대여'], ['longterm', '장기대여 · 출장']].map(([val, label]) => (
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
                {rentalType === 'longterm' && (
                  <div className="alert alert-warn mt-2.5" style={{ marginBottom: 0, fontSize: 12 }}>
                    팀장 승인 후 정식 장기대여로 확정됩니다. 반납 예정일과 사유를 특이사항에 적어주세요.
                  </div>
                )}
              </div>
              <div className="modal-foot">
                <button onClick={() => setShowConfirmModal(false)} className="btn btn-outline">취소</button>
                <button onClick={confirmRent} className="btn btn-primary">{rentalType === 'longterm' ? '승인 요청' : '대여하기'}</button>
              </div>
            </div>
          </div>
        )}

        {showRemarkPrompt && (
          <div className="modal-overlay" onClick={() => handleRemarkPrompt(false)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div className="modal-title">특이사항 등록</div>
              </div>
              <div className="modal-body">
                기기 상태 등 기록해둘 특이사항이 있나요?
              </div>
              <div className="modal-foot">
                <button onClick={() => handleRemarkPrompt(false)} className="btn btn-outline">없음 — 바로 대여</button>
                <button onClick={() => handleRemarkPrompt(true)} className="btn btn-primary">특이사항 입력</button>
              </div>
            </div>
          </div>
        )}

        {showRemarkModal && (
          <div className="modal-overlay" onClick={closeRemarkModal}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <div className="modal-title">{rentalType === 'longterm' ? '장기대여 사유 입력' : '특이사항 입력'}</div>
                  <div className="text-xs text-sub mt-0.5"><span className="td-mono">{currentSerialNumber}</span></div>
                </div>
                <button className="icon-btn" aria-label="닫기" onClick={closeRemarkModal}><XIcon size={14} /></button>
              </div>
              <div className="modal-body">
                {rentalType === 'longterm' && (
                  <div className="alert alert-warn" style={{ fontSize: 12 }}>
                    팀장 승인 후 정식 장기대여로 확정됩니다.
                  </div>
                )}
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder={rentalType === 'longterm'
                    ? '예) 6/30까지 ○○프로젝트 업데이트 대응 장기 대여'
                    : '예) 액정 좌측 상단 미세 기스, 케이스 동봉'}
                  className="input w-full resize-none"
                  rows={4}
                />
              </div>
              <div className="modal-foot">
                <button onClick={closeRemarkModal} className="btn btn-outline">취소</button>
                <button onClick={() => { setShowRemarkModal(false); submitRent(); }} className="btn btn-primary">{rentalType === 'longterm' ? '승인 요청' : '대여하기'}</button>
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
                기기 상태가 변했다면(파손·수리 필요 등) "상태 변경과 함께 반납"을 선택하세요.
              </div>
              <div className="modal-foot">
                <button onClick={openStatusModal} className="btn btn-outline">상태 변경과 함께 반납</button>
                <button onClick={() => handleReturn(false)} className="btn btn-primary">반납하기</button>
              </div>
            </div>
          </div>
        )}

        {showStatusModal && (
          <div className="modal-overlay" onClick={closeStatusModal}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <div className="modal-title">상태 변경 반납</div>
                  <div className="text-xs text-sub mt-0.5"><span className="td-mono">{currentSerialNumber}</span></div>
                </div>
                <button className="icon-btn" aria-label="닫기" onClick={closeStatusModal}><XIcon size={14} /></button>
              </div>
              <div className="modal-body">
                <label className="field-label">변경할 상태</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="input w-full mb-3"
                >
                  <option value="active">활성화</option>
                  <option value="repair">수리중</option>
                  <option value="inactive">비활성화</option>
                </select>
                <label className="field-label">사유</label>
                <textarea
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="상태 변경 사유를 입력하세요"
                  className="input w-full resize-none"
                  rows={3}
                />
              </div>
              <div className="modal-foot">
                <button onClick={closeStatusModal} className="btn btn-outline">취소</button>
                <button onClick={() => handleReturn(true)} className="btn btn-primary">반납하기</button>
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
