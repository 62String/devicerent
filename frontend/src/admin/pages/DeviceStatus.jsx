import React, { useState, useEffect } from 'react';
import axios from 'axios';

const DeviceStatus = () => {
  const [devices, setDevices] = useState([]);
  const [filteredDevices, setFilteredDevices] = useState([]);
  const [searchSerial, setSearchSerial] = useState('');
  const [error, setError] = useState(null);
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [selectedRemark, setSelectedRemark] = useState('');
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  console.log('DeviceStatus initialized - token:', token);
  console.log('DeviceStatus initialized - apiUrl:', apiUrl);

  useEffect(() => {
    if (!token) {
      console.log('No token found, setting error');
      setError('토큰이 없습니다. 로그인 해 주세요.');
      return;
    }
    fetchStatus();
  }, [token]);

  const fetchStatus = async () => {
    try {
      console.log('Fetching device status from:', `${apiUrl}/api/devices/status`);
      const response = await axios.get(`${apiUrl}/api/devices/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('DeviceStatus fetchStatus response:', response.data);
      if (response.data && Array.isArray(response.data)) {
        console.log('Data received, setting devices:', response.data);
        setDevices(response.data);
        setFilteredDevices(response.data);
      } else {
        console.log('No valid data received, resetting devices');
        setDevices([]);
        setFilteredDevices([]);
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching device status:', err);
      console.error('Error details:', err.response?.data || err.message);
      setError('디바이스 상태를 불러오지 못했습니다. 서버를 확인해 주세요.');
    }
  };

  const handleSearch = () => {
    console.log('Handling search with serial:', searchSerial);
    if (!searchSerial.trim()) {
      console.log('Search serial empty, resetting to all devices');
      setFilteredDevices(devices);
      return;
    }
    const filtered = devices.filter(device => 
      device && device.serialNumber.toLowerCase().includes(searchSerial.toLowerCase())
    );
    console.log('Filtered devices:', filtered);
    setFilteredDevices(filtered);
  };

  const handleReset = () => {
    console.log('Resetting search');
    setSearchSerial('');
    setFilteredDevices(devices);
  };

  const openRemarkModal = (remark) => {
    console.log('Opening remark modal with remark:', remark);
    setSelectedRemark(remark);
    setShowRemarkModal(true);
  };

  const closeRemarkModal = () => {
    console.log('Closing remark modal');
    setShowRemarkModal(false);
    setSelectedRemark('');
  };

  return (
    <div>
      <h2>현재 대여 현황</h2>
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={searchSerial}
          onChange={(e) => setSearchSerial(e.target.value)}
          placeholder="시리얼 번호 검색"
          style={{ padding: '5px', marginRight: '10px' }}
        />
        <button onClick={handleSearch}>검색</button>
        <button onClick={handleReset} style={{ marginLeft: '10px' }}>
          초기화
        </button>
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!error && filteredDevices.length === 0 && <p>대여 중인 디바이스가 없습니다.</p>}
      {!error && filteredDevices.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>시리얼 번호</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>모델명</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>OS 이름</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>OS 버전</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>대여자</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>대여일시</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>특이사항</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map(device => (
              <tr key={device.serialNumber}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.serialNumber || 'N/A'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.modelName || 'N/A'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.osName || 'N/A'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.osVersion || 'N/A'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {device.rentedBy ? `${device.rentedBy.name} (${device.rentedBy.affiliation || 'N/A'})` : '없음'}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {device.rentedAt ? new Date(device.rentedAt).toLocaleString() : '없음'}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {device.remark ? (
                    <button
                      onClick={() => openRemarkModal(device.remark)}
                      style={{ padding: '5px 10px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                    >
                      보기
                    </button>
                  ) : (
                    '없음'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {showRemarkModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{
            backgroundColor: 'white', padding: '20px', borderRadius: '5px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)', width: '400px', textAlign: 'center'
          }}>
            <h3>특이사항</h3>
            <p style={{ margin: '20px 0', whiteSpace: 'pre-wrap' }}>{selectedRemark}</p>
            <button
              onClick={closeRemarkModal}
              style={{ padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceStatus;