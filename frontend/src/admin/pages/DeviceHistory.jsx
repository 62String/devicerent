import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ko } from 'date-fns/locale';
import { saveAs } from 'file-saver';
import { SearchIcon, XIcon, DownloadIcon } from '../../components/Icons';

const formatOs = (osName, osVersion) => {
  if (!osName && !osVersion) return 'N/A';
  if (!osVersion || osVersion === 'N/A') return osName || 'N/A';
  if (!osName || osName === 'N/A' || osVersion.toLowerCase().startsWith(osName.toLowerCase())) return osVersion;
  return `${osName} ${osVersion}`;
};

const STATUS_BADGE = {
  active: { label: '활성', className: 'badge badge-ok' },
  repair: { label: '수리중', className: 'badge badge-warn' },
  inactive: { label: '비활성', className: 'badge badge-neutral' },
};

function DeviceHistory() {
  const [historyPairs, setHistoryPairs] = useState([]);
  const [originalPairs, setOriginalPairs] = useState([]);
  const [devices, setDevices] = useState([]);
  const [searchSerial, setSearchSerial] = useState('');
  const [error, setError] = useState(null);
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [selectedRemark, setSelectedRemark] = useState('');
  const [remarkModalTitle, setRemarkModalTitle] = useState('특이사항');
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [perPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4000`;

  useEffect(() => {
    let isMounted = true;

    const fetchDevices = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/devices`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (isMounted) {
          setDevices(response.data);
        }
      } catch (err) {
        // 디바이스 상태 보조 데이터 — 실패해도 히스토리 표시는 계속
      }
    };

    fetchDevices();

    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        let url = `${apiUrl}/api/devices/history`;
        if (selectedPeriod === 'custom' && customDateRange.start && customDateRange.end) {
          url += `?startDate=${customDateRange.start}&endDate=${customDateRange.end}`;
        } else if (selectedPeriod === 'week') {
          const now = new Date();
          const start = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
          url += `?startDate=${start}&endDate=${new Date().toISOString().split('T')[0]}`;
        } else if (selectedPeriod === 'month') {
          const now = new Date();
          const start = new Date(now.setMonth(now.getMonth() - 1)).toISOString().split('T')[0];
          url += `?startDate=${start}&endDate=${new Date().toISOString().split('T')[0]}`;
        }
        const historyResponse = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        let sortedHistory = [];
        if (isMounted && historyResponse.data && Array.isArray(historyResponse.data)) {
          sortedHistory = historyResponse.data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        }
        const pairs = [];
        const rentRecords = [];

        sortedHistory.forEach(record => {
          if (record.action === 'rent') {
            rentRecords.push(record);
          } else if (record.action === 'return') {
            const matchingRent = rentRecords.find(rent =>
              rent.serialNumber === record.serialNumber && !rent.matched
            );
            const device = devices.find(d => d.serialNumber === record.serialNumber);
            if (matchingRent) {
              pairs.push({
                serialNumber: record.serialNumber,
                modelName: record.deviceInfo?.modelName || matchingRent.deviceInfo?.modelName || 'N/A',
                osName: record.deviceInfo?.osName || matchingRent.deviceInfo?.osName || 'N/A',
                osVersion: record.deviceInfo?.osVersion || matchingRent.deviceInfo?.osVersion || 'N/A',
                userDetails: record.userDetails?.name || matchingRent.userDetails?.name || '알 수 없음',
                rentTime: new Date(matchingRent.timestamp).toLocaleString(),
                returnTime: new Date(record.timestamp).toLocaleString(),
                remark: matchingRent.remark || '',
                status: device?.status || 'N/A',
                statusReason: device?.statusReason || ''
              });
              matchingRent.matched = true;
            } else {
              pairs.push({
                serialNumber: record.serialNumber,
                modelName: record.deviceInfo?.modelName || 'N/A',
                osName: record.deviceInfo?.osName || 'N/A',
                osVersion: record.deviceInfo?.osVersion || 'N/A',
                userDetails: record.userDetails?.name || '알 수 없음',
                rentTime: 'N/A',
                returnTime: new Date(record.timestamp).toLocaleString(),
                remark: '',
                status: device?.status || 'N/A',
                statusReason: device?.statusReason || ''
              });
            }
          }
        });

        rentRecords.forEach(rent => {
          if (!rent.matched) {
            const device = devices.find(d => d.serialNumber === rent.serialNumber);
            pairs.push({
              serialNumber: rent.serialNumber,
              modelName: rent.deviceInfo?.modelName || 'N/A',
              osName: rent.deviceInfo?.osName || 'N/A',
              osVersion: rent.deviceInfo?.osVersion || 'N/A',
              userDetails: rent.userDetails?.name || '알 수 없음',
              rentTime: new Date(rent.timestamp).toLocaleString(),
              returnTime: 'N/A',
              remark: rent.remark || '',
              status: device?.status || 'N/A',
              statusReason: device?.statusReason || ''
            });
          }
        });

        const sortedPairs = pairs.sort((a, b) => {
          const aTime = a.returnTime !== 'N/A' ? new Date(a.returnTime) : new Date(a.rentTime);
          const bTime = b.returnTime !== 'N/A' ? new Date(b.returnTime) : new Date(b.rentTime);
          return bTime - aTime;
        });

        setHistoryPairs(sortedPairs);
        setOriginalPairs(sortedPairs);
      } catch (err) {
        if (isMounted) {
          setError('데이터를 불러오지 못했습니다. 서버를 확인해 주세요.');
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [token, selectedPeriod, customDateRange]);

  const handleSearch = (value) => {
    setSearchSerial(value);
    const trimmedSearch = value.trim();
    if (!trimmedSearch) {
      setHistoryPairs(originalPairs);
      setCurrentPage(1);
      return;
    }
    const filtered = originalPairs.filter(pair =>
      pair.serialNumber.toLowerCase().includes(trimmedSearch.toLowerCase())
    );
    setHistoryPairs(filtered);
    setCurrentPage(1);
  };

  const handleReset = () => {
    setSearchSerial('');
    setSelectedPeriod('all');
    setCustomDateRange({ start: '', end: '' });
    setHistoryPairs(originalPairs);
    setCurrentPage(1);
  };

  const handleExport = async () => {
    let payload = {};
    if (selectedPeriod === 'custom' && customDateRange.start && customDateRange.end) {
      payload = { startDate: customDateRange.start, endDate: customDateRange.end };
    } else if (selectedPeriod === 'week') {
      const now = new Date();
      const start = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
      const end = new Date().toISOString().split('T')[0];
      payload = { startDate: start, endDate: end };
    } else if (selectedPeriod === 'month') {
      const now = new Date();
      const start = new Date(now.setMonth(now.getMonth() - 1)).toISOString().split('T')[0];
      const end = new Date().toISOString().split('T')[0];
      payload = { startDate: start, endDate: end };
    } else if (selectedPeriod === 'all') {
      payload = { period: 'all' };
    }
    try {
      const response = await axios.post(`${apiUrl}/api/devices/history/export`, payload, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'arraybuffer'
      });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const fileName = selectedPeriod === 'custom'
        ? `history_export_${customDateRange.start}_to_${customDateRange.end}.xlsx`
        : `history_export_${selectedPeriod}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      saveAs(blob, fileName);
    } catch (error) {
      alert('엑셀 내보내기에 실패했습니다.');
    }
  };

  const openRemarkModal = (text, title = '특이사항') => {
    setSelectedRemark(text);
    setRemarkModalTitle(title);
    setShowRemarkModal(true);
  };

  const closeRemarkModal = () => {
    setShowRemarkModal(false);
    setSelectedRemark('');
  };

  const totalPages = Math.max(1, Math.ceil(historyPairs.length / perPage));
  const offset = (currentPage - 1) * perPage;
  const currentPairs = historyPairs.slice(offset, offset + perPage);

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
            <h1 className="page-title">대여 히스토리</h1>
            <p className="page-sub">대여/반납 기록을 기간별로 조회하고 엑셀로 내보냅니다</p>
          </div>
          <button onClick={handleExport} className="btn btn-ink">
            <DownloadIcon size={14} />
            엑셀 다운로드
          </button>
        </div>

        <div className="flex gap-2 mt-5 mb-4 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-hint pointer-events-none">
              <SearchIcon size={14} />
            </span>
            <input
              type="text"
              value={searchSerial}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="시리얼 번호 검색"
              className="input w-full pl-9"
            />
          </div>
          <select
            value={selectedPeriod}
            onChange={(e) => {
              setSelectedPeriod(e.target.value);
              if (e.target.value !== 'custom') {
                setCustomDateRange({ start: '', end: '' });
              }
            }}
            className="input"
          >
            <option value="all">전체 기간</option>
            <option value="week">지난 1주일</option>
            <option value="month">지난 1개월</option>
            <option value="custom">사용자 지정</option>
          </select>
          {selectedPeriod === 'custom' && (
            <div className="flex items-center gap-2">
              <DatePicker
                selected={customDateRange.start ? new Date(customDateRange.start) : null}
                onChange={date => setCustomDateRange({ ...customDateRange, start: date.toISOString().split('T')[0] })}
                selectsStart
                startDate={customDateRange.start ? new Date(customDateRange.start) : null}
                endDate={customDateRange.end ? new Date(customDateRange.end) : null}
                minDate={new Date('2020-01-01')}
                placeholderText="시작 날짜"
                locale={ko}
                weekStartsOn={0}
                className="input w-[120px]"
              />
              <span className="text-hint">~</span>
              <DatePicker
                selected={customDateRange.end ? new Date(customDateRange.end) : null}
                onChange={date => setCustomDateRange({ ...customDateRange, end: date.toISOString().split('T')[0] })}
                selectsEnd
                startDate={customDateRange.start ? new Date(customDateRange.start) : null}
                endDate={customDateRange.end ? new Date(customDateRange.end) : null}
                minDate={customDateRange.start ? new Date(customDateRange.start) : new Date('2020-01-01')}
                placeholderText="종료 날짜"
                locale={ko}
                weekStartsOn={0}
                className="input w-[120px]"
              />
            </div>
          )}
          <button onClick={handleReset} className="btn btn-outline">초기화</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {!error && historyPairs.length === 0 && (
          <div className="card p-10 text-center text-sub text-sm">대여 히스토리가 없습니다.</div>
        )}
        {!error && historyPairs.length > 0 && (
          <>
            <div className="card overflow-x-auto">
              <table className="table-note" style={{ tableLayout: 'fixed', minWidth: 860 }}>
                <thead>
                  <tr>
                    <th style={{ width: 92 }}>시리얼</th>
                    <th style={{ width: 160 }}>디바이스 / OS</th>
                    <th style={{ width: 90 }}>대여자</th>
                    <th style={{ width: 130 }}>대여 시간</th>
                    <th style={{ width: 130 }}>반납 시간</th>
                    <th style={{ width: 70 }}>상태</th>
                    <th style={{ width: 120 }}>상태 변경 사유</th>
                    <th>특이사항</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPairs.map((pair, index) => {
                    const badge = STATUS_BADGE[pair.status];
                    return (
                      <tr key={index}>
                        <td className="td-mono">{pair.serialNumber}</td>
                        <td>
                          <div className="cell-main truncate" title={pair.modelName}>{pair.modelName}</div>
                          <div className="cell-sub">{formatOs(pair.osName, pair.osVersion)}</div>
                        </td>
                        <td className="td-sub">{pair.userDetails}</td>
                        <td className="td-sub text-xs">{pair.rentTime === 'N/A' ? <span className="td-hint">—</span> : pair.rentTime}</td>
                        <td className="td-sub text-xs">
                          {pair.returnTime === 'N/A'
                            ? <span className="badge badge-warn">대여중</span>
                            : pair.returnTime}
                        </td>
                        <td>
                          {badge
                            ? <span className={badge.className}>{badge.label}</span>
                            : <span className="td-hint">—</span>}
                        </td>
                        <td>
                          {pair.statusReason ? (
                            <button
                              type="button"
                              className="remark-preview w-full"
                              title="클릭하여 전체 보기"
                              onClick={() => openRemarkModal(pair.statusReason, '상태 변경 사유')}
                            >
                              {pair.statusReason}
                            </button>
                          ) : (
                            <span className="td-hint">—</span>
                          )}
                        </td>
                        <td>
                          {pair.remark ? (
                            <button
                              type="button"
                              className="remark-preview w-full"
                              title="클릭하여 전체 보기"
                              onClick={() => openRemarkModal(pair.remark, '특이사항')}
                            >
                              {pair.remark}
                            </button>
                          ) : (
                            <span className="td-hint">—</span>
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
                총 {historyPairs.length}건 중 {offset + 1}–{Math.min(offset + perPage, historyPairs.length)}
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
              <span />
            </div>
          </>
        )}

        {showRemarkModal && (
          <div className="modal-overlay" onClick={closeRemarkModal}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div className="modal-title">{remarkModalTitle}</div>
                <button className="icon-btn" aria-label="닫기" onClick={closeRemarkModal}><XIcon size={14} /></button>
              </div>
              <div className="modal-body">
                <div className="modal-note">{selectedRemark}</div>
              </div>
              <div className="modal-foot">
                <button onClick={closeRemarkModal} className="btn btn-outline">닫기</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DeviceHistory;
