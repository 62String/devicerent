import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../utils/AuthContext';
import { SearchIcon, XIcon } from '../../components/Icons';

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

const DeviceStatus = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState([]);
  const [filteredDevices, setFilteredDevices] = useState([]);
  const [searchSerial, setSearchSerial] = useState('');
  const [error, setError] = useState(null);
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [selectedRemark, setSelectedRemark] = useState('');
  const [selectedSerial, setSelectedSerial] = useState('');
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4000`;

  useEffect(() => {
    if (!token) {
      setError('토큰이 없습니다. 로그인 해 주세요.');
      return;
    }
    fetchStatus();
  }, [token]);

  const fetchStatus = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/devices/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data && Array.isArray(response.data)) {
        setDevices(response.data);
        setFilteredDevices(response.data);
      } else {
        setDevices([]);
        setFilteredDevices([]);
      }
      setError(null);
    } catch (err) {
      setError('디바이스 상태를 불러오지 못했습니다. 서버를 확인해 주세요.');
    }
  };

  const handleSearch = (value) => {
    setSearchSerial(value);
    if (!value.trim()) {
      setFilteredDevices(devices);
      return;
    }
    const filtered = devices.filter(device =>
      device && device.serialNumber.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredDevices(filtered);
  };

  const openRemarkModal = (device) => {
    setSelectedRemark(device.remark);
    setSelectedSerial(device.serialNumber);
    setShowRemarkModal(true);
  };

  const closeRemarkModal = () => {
    setShowRemarkModal(false);
    setSelectedRemark('');
    setSelectedSerial('');
  };

  return (
    <div className="min-h-screen bg-paper">
      <div className="page-wrap">
        <h1 className="page-title">대여 현황</h1>
        <p className="page-sub">현재 대여 중인 디바이스 목록입니다</p>

        <div className="flex gap-2 mt-5 mb-4 flex-wrap items-center">
          <div className="relative flex-1 min-w-[220px]">
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
          <button onClick={() => handleSearch('')} className="btn btn-outline">초기화</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {!error && filteredDevices.length === 0 && (
          <div className="card p-10 text-center text-sub text-sm">대여 중인 디바이스가 없습니다.</div>
        )}
        {!error && filteredDevices.length > 0 && (
          <div className="card overflow-x-auto">
            <table className="table-note" style={{ tableLayout: 'fixed', minWidth: 680 }}>
              <thead>
                <tr>
                  <th style={{ width: 96 }}>시리얼</th>
                  <th style={{ width: 190 }}>디바이스 / OS</th>
                  <th style={{ width: 130 }}>대여자</th>
                  <th style={{ width: 110 }}>대여일시</th>
                  <th>특이사항</th>
                </tr>
              </thead>
              <tbody>
                {filteredDevices.map(device => {
                  const rented = formatRentedAt(device.rentedAt);
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
                            <div className="td-sub">{rented.date.slice(5)}</div>
                            <div className="cell-sub">{rented.time}</div>
                          </>
                        ) : (
                          <span className="td-hint">—</span>
                        )}
                      </td>
                      <td>
                        {device.remark ? (
                          <button
                            type="button"
                            className="remark-preview w-full"
                            title="클릭하여 전체 보기"
                            onClick={() => openRemarkModal(device)}
                          >
                            {device.remark}
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
        )}

        {showRemarkModal && (
          <div className="modal-overlay" onClick={closeRemarkModal}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <div className="modal-title">특이사항</div>
                  <div className="text-xs text-sub mt-0.5"><span className="td-mono">{selectedSerial}</span></div>
                </div>
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
};

export default DeviceStatus;
