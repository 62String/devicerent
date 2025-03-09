import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './utils/AuthContext';

function Devices() {
  const [devices, setDevices] = useState([]);
  const [filteredDevices, setFilteredDevices] = useState([]);
  const [searchSerial, setSearchSerial] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  console.log('Devices (Main) user:', user);
  console.log('Devices (Main) token:', token);
  console.log('Devices (Main) apiUrl:', apiUrl);

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
      console.log('Fetch devices response:', response.data);
      setDevices(response.data);
      setFilteredDevices(response.data);
    } catch (error) {
      console.error('Error fetching devices:', error);
      setError(error.response?.data?.message || 'Failed to fetch devices');
      if (error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => {
    if (!token || !user) {
      navigate('/login');
      return;
    }
    fetchDevices();
  }, [fetchDevices, token, user, navigate]);

  const handleRent = async (serialNumber) => {
    try {
      console.log('Renting device with serialNumber:', serialNumber);
      const response = await axios.post(`${apiUrl}/api/devices/rent-device`, { deviceId: serialNumber }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert(response.data.message);
      fetchDevices();
    } catch (error) {
      alert(error.response?.data?.message || 'Rent failed');
      console.error('Rent error:', error);
    }
  };

  const handleReturn = async (serialNumber) => {
    try {
      console.log('Returning device with serialNumber:', serialNumber, 'Current User:', user);
      const response = await axios.post(`${apiUrl}/api/devices/return-device`, { deviceId: serialNumber }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert(response.data.message);
      fetchDevices();
    } catch (error) {
      alert(error.response?.data?.message || 'Return failed');
      console.error('Return error:', error.response?.data);
    }
  };

  const handleSearch = () => {
    if (!searchSerial.trim()) {
      setFilteredDevices(devices);
      return;
    }
    const filtered = devices.filter(device =>
      device.serialNumber.toLowerCase().includes(searchSerial.toLowerCase())
    );
    setFilteredDevices(filtered);
  };

  const showMyDevices = () => {
    if (!user) return;
    const myDevices = devices.filter(device =>
      device.rentedBy && device.rentedBy.name === user.name
    );
    setFilteredDevices(myDevices);
  };

  return (
    <div>
      <h1>Device Rental System</h1>
      {user && (
        <div style={{ marginBottom: '20px' }}>
          {user.isAdmin && (
            <>
              <button onClick={() => navigate('/admin')} style={{ marginRight: '10px' }}>
                관리자 페이지
              </button>
              <button onClick={() => navigate('/devices/status')} style={{ marginRight: '10px' }}>
                대여 현황
              </button>
              <button onClick={() => navigate('/devices/history')} style={{ marginRight: '10px' }}>
                대여 히스토리
              </button>
              <button onClick={() => navigate('/devices/manage')} style={{ marginRight: '10px' }}>
                디바이스 관리
              </button>
            </>
          )}
        </div>
      )}
      <h2>디바이스 목록</h2>
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={searchSerial}
          onChange={(e) => setSearchSerial(e.target.value)}
          placeholder="시리얼 번호 검색"
          style={{ padding: '5px', marginRight: '10px' }}
        />
        <button onClick={handleSearch}>검색</button>
        <button onClick={() => { setSearchSerial(''); setFilteredDevices(devices); }} style={{ marginLeft: '10px' }}>
          초기화
        </button>
        <button onClick={showMyDevices} style={{ marginLeft: '10px' }}>
          내가 빌린 디바이스
        </button>
      </div>
      {loading ? (
        <p>디바이스 목록을 불러오는 중...</p>
      ) : error ? (
        <p style={{ color: 'red', fontWeight: 'bold' }}>{error}</p>
      ) : filteredDevices.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>시리얼 번호</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>디바이스 정보</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>모델명</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>상태</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>대여자</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>액션</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map(device => (
              <tr key={device.serialNumber}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.serialNumber}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.deviceInfo}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.modelName}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.status}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {device.rentedBy ? `${device.rentedBy.name} (${device.rentedBy.affiliation})` : '없음'}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {device.rentedBy ? (
                    user && device.rentedBy.name === user.name ? (
                      <button onClick={() => handleReturn(device.serialNumber)}>[반납]</button>
                    ) : (
                      <span>대여중</span>
                    )
                  ) : (
                    <button onClick={() => handleRent(device.serialNumber)}>[대여]</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>디바이스 목록이 없습니다.</p>
      )}
    </div>
  );
}

export default Devices;