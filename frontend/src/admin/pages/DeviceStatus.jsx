import React, { useState, useEffect } from 'react';
import axios from 'axios';

const DeviceStatus = () => {
  const [devices, setDevices] = useState([]);
  const [filteredDevices, setFilteredDevices] = useState([]);
  const [searchSerial, setSearchSerial] = useState('');
  const [error, setError] = useState(null);
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  console.log('DeviceStatus token:', token);
  console.log('DeviceStatus apiUrl:', apiUrl);

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
      console.log('DeviceStatus fetchStatus response:', response.data);
      if (response.data && Array.isArray(response.data)) {
        setDevices(response.data);
        setFilteredDevices(response.data); // 초기 필터링
      } else {
        setDevices([]);
        setFilteredDevices([]);
      }
      setError(null);
    } catch (err) {
      setError('디바이스 상태를 불러오지 못했습니다. 서버를 확인해 주세요.');
      console.error('Error fetching device status:', err);
      console.error('Error details:', err.response?.data || err.message);
    }
  };

  const handleSearch = () => {
    if (!searchSerial.trim()) {
      setFilteredDevices(devices);
      return;
    }
    const filtered = devices.filter(device => 
      device && device.serialNumber.toLowerCase().includes(searchSerial.toLowerCase())
    );
    setFilteredDevices(filtered);
  };

  const handleReset = () => {
    setSearchSerial('');
    setFilteredDevices(devices);
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default DeviceStatus;