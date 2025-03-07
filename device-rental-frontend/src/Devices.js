import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Devices() {
  const [devices, setDevices] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchDevices();
    fetchCurrentUser();
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await axios.get('http://localhost:4000/devices', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDevices(response.data);
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get('http://localhost:4000/api/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentUser(response.data.user);
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const syncData = async () => {
    try {
      const response = await axios.post('http://localhost:4000/api/sync', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsPopupOpen(true);
    } catch (error) {
      console.error('Error syncing data:', error);
    }
  };

  const handleRent = async (deviceId) => {
    try {
      const response = await axios.post('http://localhost:4000/api/rent-device', { deviceId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(response.data.message);
      fetchDevices(); // 갱신
    } catch (error) {
      alert(error.response?.data?.message || 'Rent failed');
    }
  };

  const handleReturn = async (deviceId) => {
    try {
      const response = await axios.post('http://localhost:4000/api/return-device', { deviceId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(response.data.message);
      fetchDevices(); // 갱신
    } catch (error) {
      alert(error.response?.data?.message || 'Return failed');
    }
  };

  return (
    <div>
      <h1>Device Rental System</h1>
      <button onClick={syncData}>데이터 동기화</button>
      {isPopupOpen && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#fff', padding: '20px', border: '1px solid #ccc' }}>
          <p>데이터가 성공적으로 동기화되었습니다!</p>
          <button onClick={() => setIsPopupOpen(false)}>닫기</button>
        </div>
      )}
      <h2>디바이스 목록</h2>
      {devices.length > 0 ? (
        <ul>
          {devices.map(device => (
            <li key={device.id}>
              {device.deviceInfo} - {device.category}
              {device.rentedBy ? (
                device.rentedBy._id === currentUser?._id ? (
                  <button onClick={() => handleReturn(device.id)}>[반납]</button>
                ) : (
                  <span> [대여중] {device.rentedBy.username}</span>
                )
              ) : (
                <button onClick={() => handleRent(device.id)}>[대여]</button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>디바이스 목록을 불러오는 중...</p>
      )}
    </div>
  );
}

export default Devices;