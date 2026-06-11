import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../utils/AuthContext';
import { getApiUrl } from '../../utils/api';
import { SearchIcon, XIcon, DownloadIcon, RefreshIcon, ClockIcon } from '../../components/Icons';

const STATUS_BADGE = {
  active: { label: '활성', className: 'badge badge-ok' },
  repair: { label: '수리중', className: 'badge badge-warn' },
  inactive: { label: '비활성', className: 'badge badge-neutral' },
};

const formatOs = (osName, osVersion) => {
  if (!osName && !osVersion) return 'N/A';
  if (!osVersion) return osName;
  if (!osName || osVersion.toLowerCase().startsWith(osName.toLowerCase())) return osVersion;
  return `${osName} ${osVersion}`;
};

const DeviceManage = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState([]);
  const [newDevice, setNewDevice] = useState({ serialNumber: '', deviceInfo: '', osName: '', osVersion: '', modelName: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInitModal, setShowInitModal] = useState(false);
  const [showExportConfirmModal, setShowExportConfirmModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadFileName, setDownloadFileName] = useState('');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [newStatus, setNewStatus] = useState('active');
  const [statusReason, setStatusReason] = useState('');
  const [forceInit, setForceInit] = useState(false);
  const [latestExportPath, setLatestExportPath] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showStatusHistory, setShowStatusHistory] = useState(false);
  const [statusHistory, setStatusHistory] = useState([]);
  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
  const devicesPerPage = 50;
  const historyPerPage = 50;
  const token = localStorage.getItem('token');
  const apiUrl = getApiUrl();

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/devices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!Array.isArray(response.data)) {
        setError('디바이스 데이터 형식이 올바르지 않습니다.');
        return;
      }
      setDevices(response.data);
      setError(null);
    } catch (err) {
      setError('디바이스 목록을 불러오지 못했습니다. 서버를 확인해 주세요.');
    }
  };

  const fetchStatusHistory = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/devices/status-history`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      setStatusHistory(response.data);
      setShowStatusHistory(true);
    } catch (err) {
      setMessage('상태 변경 이력 조회 실패');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const hideStatusHistory = () => {
    setShowStatusHistory(false);
    setStatusHistory([]);
    setHistoryCurrentPage(1);
  };

  const filteredDevices = devices.filter(device =>
    device.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.modelName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.osName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredStatusHistory = statusHistory.filter(history =>
    history.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (history.modelName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (history.osName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedDevices = [...filteredDevices].sort((a, b) => {
    if (!sortField) return 0;
    const aValue = a[sortField];
    const bValue = b[sortField];
    if (aValue == null) return sortOrder === 'asc' ? 1 : -1;
    if (bValue == null) return sortOrder === 'asc' ? -1 : 1;
    return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
  });

  const indexOfLastDevice = currentPage * devicesPerPage;
  const indexOfFirstDevice = indexOfLastDevice - devicesPerPage;
  const currentDevices = sortedDevices.slice(indexOfFirstDevice, indexOfLastDevice);
  const totalPages = Math.max(1, Math.ceil(filteredDevices.length / devicesPerPage));
  const historyTotalPages = Math.max(1, Math.ceil(filteredStatusHistory.length / historyPerPage));

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

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!newDevice.serialNumber || !newDevice.deviceInfo || !newDevice.osName) {
      setMessage('시리얼 번호, 디바이스 정보, OS 이름은 필수 입력 항목입니다.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    try {
      const response = await axios.post(`${apiUrl}/api/devices/manage/register`, newDevice, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      setMessage(response.data.message);
      setTimeout(() => setMessage(''), 3000);
      setNewDevice({ serialNumber: '', deviceInfo: '', osName: '', osVersion: '', modelName: '' });
      fetchDevices();
    } catch (err) {
      setMessage(err.response?.data?.message || '등록 실패');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const openDeleteModal = (serialNumber) => {
    setSelectedDevice({ serialNumber });
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setSelectedDevice(null);
  };

  const handleDelete = async () => {
    try {
      const response = await axios.post(`${apiUrl}/api/devices/manage/delete`, { serialNumber: selectedDevice.serialNumber }, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      setMessage(response.data.message);
      setTimeout(() => setMessage(''), 3000);
      fetchDevices();
    } catch (err) {
      setMessage('삭제 실패');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      closeDeleteModal();
    }
  };

  const openStatusModal = (device) => {
    setSelectedDevice(device);
    setNewStatus(device.status);
    setStatusReason(device.statusReason || '');
    setShowStatusModal(true);
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setSelectedDevice(null);
    setNewStatus('active');
    setStatusReason('');
  };

  const handleUpdateStatus = async () => {
    try {
      const response = await axios.post(`${apiUrl}/api/devices/manage/update-status`, {
        serialNumber: selectedDevice.serialNumber,
        status: newStatus,
        statusReason: statusReason || ''
      }, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      setMessage(response.data.message);
      setTimeout(() => setMessage(''), 3000);
      fetchDevices();
    } catch (err) {
      setMessage('상태 업데이트 실패');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      closeStatusModal();
    }
  };

  const handleInitDevices = async () => {
    try {
      await axios.post(
        `${apiUrl}/api/admin/init-devices`,
        { force: forceInit, exportPath: latestExportPath },
        {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          withCredentials: true,
        }
      );
      setMessage('디바이스 초기화 성공');
      setTimeout(() => setMessage(''), 3000);
      fetchDevices();
    } catch (error) {
      setMessage(error.response?.data?.message || '디바이스 초기화 실패');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const openInitModal = (force) => {
    setForceInit(force);
    setShowInitModal(true);
  };

  const closeInitModal = () => {
    setShowInitModal(false);
    setForceInit(false);
  };

  const confirmInit = () => {
    setShowInitModal(false);
    setShowExportConfirmModal(true);
  };

  const closeExportConfirmModal = () => {
    setShowExportConfirmModal(false);
    setForceInit(false);
  };

  const confirmExportAndInit = () => {
    handleInitDevices();
    setShowExportConfirmModal(false);
  };

  const closeDownloadModal = () => {
    setShowDownloadModal(false);
    setDownloadUrl('');
    setDownloadFileName('');
  };

  const exportToExcel = async () => {
    try {
      const exportData = devices.map(device => ({
        '시리얼 번호': device.serialNumber,
        '디바이스 정보': device.deviceInfo || device.modelName || 'N/A',
        '모델명': device.modelName || 'N/A',
        'OS 이름': device.osName || 'N/A',
        'OS 버전': device.osVersion || 'N/A',
        '대여자': device.rentedBy ? `${device.rentedBy.name} (${device.rentedBy.affiliation || 'N/A'})` : '없음',
        '대여일시': device.rentedAt ? new Date(device.rentedAt).toLocaleString() : '없음'
      }));

      const response = await axios.post(`${apiUrl}/api/devices/export`, exportData, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
        withCredentials: true
      });

      const dateTime = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `device_list_${dateTime}.xlsx`;
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const url = window.URL.createObjectURL(blob);
      setDownloadUrl(url);
      setDownloadFileName(fileName);
      setShowDownloadModal(true);
      setLatestExportPath(fileName);
      setMessage('엑셀 파일이 준비되었습니다. 다운로드 버튼을 눌러 저장해 주세요.');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      if (error.response && error.response.status === 200) {
        setMessage('엑셀 파일이 준비되었습니다. 다운로드 버튼을 눌러 저장해 주세요.');
      } else {
        setMessage('엑셀 익스포트 실패');
        setTimeout(() => setMessage(''), 3000);
      }
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = downloadFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      window.URL.revokeObjectURL(downloadUrl);
      closeDownloadModal();
      setMessage('파일이 다운로드되었습니다.');
      setTimeout(() => setMessage(''), 3000);
    }, 100);
  };

  const pageButtons = (page, total, setPage) => (
    <div className="flex justify-center gap-1.5 mt-4">
      <button className="pg-btn" onClick={() => setPage(prev => Math.max(prev - 1, 1))} disabled={page === 1}>‹</button>
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i + 1}
          className={`pg-btn ${page === i + 1 ? 'pg-btn-active' : ''}`}
          onClick={() => setPage(i + 1)}
        >
          {i + 1}
        </button>
      ))}
      <button className="pg-btn" onClick={() => setPage(prev => Math.min(prev + 1, total))} disabled={page === total}>›</button>
    </div>
  );

  if (!user || !user.isAdmin) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center text-sub text-sm">
        관리자 권한이 없습니다.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="page-wrap" style={{ maxWidth: 1200 }}>
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-title">디바이스 관리</h1>
            <p className="page-sub">디바이스 등록, 상태 변경, 엑셀 초기화/익스포트를 관리합니다</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => openInitModal(false)} className="btn btn-outline">
              <RefreshIcon size={14} />
              엑셀 초기화
            </button>
            <button onClick={() => openInitModal(true)} className="btn" style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
              엑셀 강제 초기화
            </button>
            <button onClick={exportToExcel} className="btn btn-ink">
              <DownloadIcon size={14} />
              엑셀 익스포트
            </button>
            <button onClick={showStatusHistory ? hideStatusHistory : fetchStatusHistory} className="btn btn-outline">
              <ClockIcon size={14} />
              {showStatusHistory ? '기기 목록 보기' : '상태 변경 이력'}
            </button>
          </div>
        </div>

        {message && (
          <div className={`alert mt-5 ${message.includes('실패') ? 'alert-error' : 'alert-success'}`}>{message}</div>
        )}
        {error && <div className="alert alert-error mt-5">{error}</div>}

        <form onSubmit={handleRegister} className="card mt-5 mb-4" style={{ borderTop: '2px solid var(--ink)' }}>
          <div className="p-4">
            <div className="text-sm font-bold text-ink mb-3">신규 디바이스 등록</div>
            <div className="flex gap-2 flex-wrap items-end">
              <div className="flex-1 min-w-[130px]">
                <label className="field-label">시리얼 번호 *</label>
                <input
                  type="text"
                  value={newDevice.serialNumber}
                  onChange={(e) => setNewDevice({ ...newDevice, serialNumber: e.target.value })}
                  placeholder="SN000"
                  required
                  className="input w-full"
                />
              </div>
              <div className="flex-1 min-w-[130px]">
                <label className="field-label">디바이스 정보 *</label>
                <input
                  type="text"
                  value={newDevice.deviceInfo}
                  onChange={(e) => setNewDevice({ ...newDevice, deviceInfo: e.target.value })}
                  placeholder="Galaxy S21"
                  required
                  className="input w-full"
                />
              </div>
              <div className="flex-1 min-w-[110px]">
                <label className="field-label">OS 이름 *</label>
                <input
                  type="text"
                  value={newDevice.osName}
                  onChange={(e) => setNewDevice({ ...newDevice, osName: e.target.value })}
                  placeholder="Android"
                  required
                  className="input w-full"
                />
              </div>
              <div className="flex-1 min-w-[100px]">
                <label className="field-label">OS 버전</label>
                <input
                  type="text"
                  value={newDevice.osVersion}
                  onChange={(e) => setNewDevice({ ...newDevice, osVersion: e.target.value })}
                  placeholder="14"
                  className="input w-full"
                />
              </div>
              <div className="flex-1 min-w-[130px]">
                <label className="field-label">모델명</label>
                <input
                  type="text"
                  value={newDevice.modelName}
                  onChange={(e) => setNewDevice({ ...newDevice, modelName: e.target.value })}
                  placeholder="SM-G991N"
                  className="input w-full"
                />
              </div>
              <button type="submit" className="btn btn-primary">등록</button>
            </div>
          </div>
        </form>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1 max-w-[320px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-hint pointer-events-none">
              <SearchIcon size={14} />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
                setHistoryCurrentPage(1);
              }}
              placeholder="시리얼, 모델명, OS 검색"
              className="input w-full pl-9"
            />
          </div>
        </div>

        {!error && (
          showStatusHistory ? (
            <>
              <div className="card overflow-x-auto">
                <table className="table-note" style={{ tableLayout: 'fixed', minWidth: 820 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 92 }}>시리얼</th>
                      <th style={{ width: 170 }}>디바이스 / OS</th>
                      <th style={{ width: 76 }}>상태</th>
                      <th>상태 변경 사유</th>
                      <th style={{ width: 96 }}>변경자</th>
                      <th style={{ width: 150 }}>변경 시간</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStatusHistory.length > 0 ? (
                      filteredStatusHistory
                        .slice((historyCurrentPage - 1) * historyPerPage, historyCurrentPage * historyPerPage)
                        .map((history, index) => {
                          const badge = STATUS_BADGE[history.status];
                          return (
                            <tr key={index}>
                              <td className="td-mono">{history.serialNumber}</td>
                              <td>
                                <div className="cell-main truncate" title={history.modelName || 'N/A'}>{history.modelName || 'N/A'}</div>
                                <div className="cell-sub">{formatOs(history.osName, history.osVersion)}</div>
                              </td>
                              <td>
                                {badge
                                  ? <span className={badge.className}>{badge.label}</span>
                                  : <span className="td-hint">{history.status || '—'}</span>}
                              </td>
                              <td className="td-sub">
                                <div className="truncate" title={history.statusReason || ''}>
                                  {history.statusReason || <span className="td-hint">—</span>}
                                </div>
                              </td>
                              <td className="td-sub">{history.performedBy || '알 수 없음'}</td>
                              <td className="td-sub text-xs">{new Date(history.timestamp).toLocaleString()}</td>
                            </tr>
                          );
                        })
                    ) : (
                      <tr>
                        <td colSpan="6" className="text-center text-sub py-8">상태 변경 이력이 없습니다.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {historyTotalPages > 1 && pageButtons(historyCurrentPage, historyTotalPages, setHistoryCurrentPage)}
            </>
          ) : (
            devices.length > 0 ? (
              <>
                <div className="card overflow-x-auto">
                  <table className="table-note" style={{ tableLayout: 'fixed', minWidth: 900 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 92 }} className="cursor-pointer select-none" onClick={() => handleSort('serialNumber')}>
                          시리얼{sortIndicator('serialNumber')}
                        </th>
                        <th style={{ width: 170 }} className="cursor-pointer select-none" onClick={() => handleSort('modelName')}>
                          디바이스 / OS{sortIndicator('modelName')}
                        </th>
                        <th style={{ width: 110 }}>대여자</th>
                        <th style={{ width: 100 }}>대여일시</th>
                        <th style={{ width: 76 }}>상태</th>
                        <th>상태 변경 사유</th>
                        <th style={{ width: 150 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentDevices.map(device => {
                        const badge = STATUS_BADGE[device.status];
                        return (
                          <tr key={device.serialNumber}>
                            <td className="td-mono">{device.serialNumber}</td>
                            <td>
                              <div className="cell-main truncate" title={device.modelName || 'N/A'}>{device.modelName || 'N/A'}</div>
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
                            <td className="td-sub text-xs">
                              {device.rentedAt ? new Date(device.rentedAt).toLocaleString() : <span className="td-hint">—</span>}
                            </td>
                            <td>
                              {badge
                                ? <span className={badge.className}>{badge.label}</span>
                                : <span className="td-hint">{device.status || '—'}</span>}
                            </td>
                            <td className="td-sub">
                              <div className="truncate" title={device.statusReason || ''}>
                                {device.statusReason || <span className="td-hint">—</span>}
                              </div>
                            </td>
                            <td className="text-right">
                              <div className="flex gap-1.5 justify-end">
                                <button onClick={() => openStatusModal(device)} className="btn btn-outline btn-sm">상태 변경</button>
                                <button
                                  onClick={() => openDeleteModal(device.serialNumber)}
                                  className="btn btn-sm"
                                  style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)' }}
                                >
                                  삭제
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && pageButtons(currentPage, totalPages, setCurrentPage)}
              </>
            ) : (
              <div className="card p-10 text-center text-sub text-sm">디바이스 목록이 없습니다.</div>
            )
          )
        )}

        {showDeleteModal && (
          <div className="modal-overlay" onClick={closeDeleteModal}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <div className="modal-title">디바이스 삭제</div>
                  <div className="text-xs text-sub mt-0.5">
                    <span className="td-mono">{selectedDevice?.serialNumber}</span> 디바이스를 삭제하시겠습니까?
                  </div>
                </div>
                <button className="icon-btn" aria-label="닫기" onClick={closeDeleteModal}><XIcon size={14} /></button>
              </div>
              <div className="modal-foot pt-4">
                <button onClick={closeDeleteModal} className="btn btn-outline">취소</button>
                <button onClick={handleDelete} className="btn btn-danger">삭제</button>
              </div>
            </div>
          </div>
        )}

        {showStatusModal && (
          <div className="modal-overlay" onClick={closeStatusModal}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <div className="modal-title">상태 변경</div>
                  <div className="text-xs text-sub mt-0.5"><span className="td-mono">{selectedDevice?.serialNumber}</span></div>
                </div>
                <button className="icon-btn" aria-label="닫기" onClick={closeStatusModal}><XIcon size={14} /></button>
              </div>
              <div className="modal-body">
                <label className="field-label">상태</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
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
                <button onClick={handleUpdateStatus} className="btn btn-primary">변경</button>
              </div>
            </div>
          </div>
        )}

        {showInitModal && (
          <div className="modal-overlay" onClick={closeInitModal}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div className="modal-title">{forceInit ? '엑셀 강제 초기화' : '엑셀 초기화'}</div>
                <button className="icon-btn" aria-label="닫기" onClick={closeInitModal}><XIcon size={14} /></button>
              </div>
              <div className="modal-body text-sub">
                {forceInit
                  ? '기존 디바이스 데이터를 모두 삭제하고 엑셀 기준으로 다시 등록합니다. 정말 진행하시겠습니까?'
                  : '엑셀 파일 기준으로 디바이스 목록을 업데이트합니다. 진행하시겠습니까?'}
              </div>
              <div className="modal-foot">
                <button onClick={closeInitModal} className="btn btn-outline">취소</button>
                <button onClick={confirmInit} className={`btn ${forceInit ? 'btn-danger' : 'btn-primary'}`}>진행</button>
              </div>
            </div>
          </div>
        )}

        {showExportConfirmModal && (
          <div className="modal-overlay" onClick={closeExportConfirmModal}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div className="modal-title">익스포트 확인</div>
                <button className="icon-btn" aria-label="닫기" onClick={closeExportConfirmModal}><XIcon size={14} /></button>
              </div>
              <div className="modal-body text-sub">
                수기로 등록한 디바이스 정보가 누락될 수 있습니다. 현재 디바이스 목록을 익스포트 하셨나요?
              </div>
              <div className="modal-foot">
                <button onClick={closeExportConfirmModal} className="btn btn-outline">아니오 — 돌아가기</button>
                <button onClick={confirmExportAndInit} className="btn btn-primary">예 — 초기화 진행</button>
              </div>
            </div>
          </div>
        )}

        {showDownloadModal && (
          <div className="modal-overlay" onClick={closeDownloadModal}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div className="modal-title">파일 다운로드</div>
                <button className="icon-btn" aria-label="닫기" onClick={closeDownloadModal}><XIcon size={14} /></button>
              </div>
              <div className="modal-body">
                <div className="modal-note">
                  <span className="td-mono" style={{ fontSize: 12 }}>{downloadFileName}</span>
                </div>
                <p className="text-xs text-sub mt-2 mb-0">파일은 브라우저 기본 다운로드 폴더에 저장됩니다.</p>
              </div>
              <div className="modal-foot">
                <button onClick={closeDownloadModal} className="btn btn-outline">취소</button>
                <button onClick={handleDownload} className="btn btn-primary">
                  <DownloadIcon size={14} />
                  다운로드
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceManage;
