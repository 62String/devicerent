import React, { useState, useEffect } from 'react';
import axios from 'axios';

const DeviceStatus = () => {
  const [devices, setDevices] = useState([]);
  const [error, setError] = useState(null);
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  console.log('DeviceStatus token:', token);
  console.log('DeviceStatus apiUrl:', apiUrl);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/devices/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('DeviceStatus fetchStatus response:', response.data);
      setDevices(response.data);
      setError(null);
    } catch (err) {
      setError('디바이스 상태를 불러오지 못했습니다. 서버를 확인해 주세요.');
      console.error('Error fetching device status:', err);
      console.error('Error details:', err.response?.data || err.message);
    }
  };

  return (
    <div>
      <h2>현재 대여 현황</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!error && devices.length === 0 && <p>대여 중인 디바이스가 없습니다.</p>}
      {!error && devices.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>시리얼 번호</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>모델명</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>대여자</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>대여 시간</th>
            </tr>
          </thead>
          <tbody>
            {devices.map(device => (
              <tr key={device.serialNumber}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.serialNumber}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.modelName}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.rentedBy?.name || '없음'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.rentedAt ? new Date(device.rentedAt).toLocaleString() : '없음'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default DeviceStatus;