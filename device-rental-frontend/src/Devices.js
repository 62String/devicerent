import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Devices() {
  const [devices, setDevices] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching devices with token:', token);
      const response = await axios.get('http://localhost:4000/api/devices', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Fetch response:', response.data);
      setDevices(response.data.devices || response.data);
    } catch (error) {
      console.error('Error fetching devices:', error);
      setError(error.response?.data?.message || 'Failed to fetch devices');
      if (error.response?.status === 401) {
        navigate('/login'); // 인증 실패 시 로그인 페이지로 리다이렉트
      }
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await axios.get('http://localhost:4000/api/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Fetched user data:', response.data);
      const userData = response.data.user || response.data; // 중첩 구조 처리
      setCurrentUser(userData);
      console.log('Set current user:', userData);
    } catch (error) {
      console.error('Error fetching current user:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      }
    }
  }, [token, navigate]);

  useEffect(() => {
    if (!token) {
      navigate('/login'); // 토큰이 없으면 로그인 페이지로 리다이렉트
      return;
    }
    fetchDevices();
    fetchCurrentUser();
  }, [fetchDevices, fetchCurrentUser, token, navigate]);

  const handleRent = async (deviceId) => {
    try {
      console.log('Renting device with ID:', deviceId);
      const response = await axios.post('http://localhost:4000/api/rent-device', { deviceId: Number(deviceId) }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(response.data.message);
      fetchDevices();
    } catch (error) {
      alert(error.response?.data?.message || 'Rent failed');
    }
  };

  const handleReturn = async (deviceId) => {
    try {
      console.log('Returning device with ID:', deviceId, 'Current User:', currentUser);
      const response = await axios.post('http://localhost:4000/api/return-device', { deviceId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(response.data.message);
      fetchDevices();
    } catch (error) {
      console.log('Return error:', error.response?.data);
      alert(error.response?.data?.message || 'Return failed');
    }
  };

  return (
    <div>
      <h1>Device Rental System</h1>
      {console.log('Current user in render:', currentUser)}
      {currentUser && currentUser.isAdmin && (
        <button onClick={() => navigate('/admin')}>관리자 페이지</button>
      )}
      <h2>디바이스 목록</h2>
      {loading ? (
        <p>디바이스 목록을 불러오는 중...</p>
      ) : error ? (
        <p style={{ color: 'red', fontWeight: 'bold' }}>{error}</p>
      ) : devices.length > 0 ? (
        <ul>
          {devices.map(device => (
            <li key={device.id}>
              {device.deviceInfo} - {device.category}
              {device.rentedBy && typeof device.rentedBy === 'object' ? (
                console.log('RentedBy:', device.rentedBy, 'Current User:', currentUser) ||
                (currentUser && device.rentedBy.name === currentUser.name ? (
                  <button onClick={() => handleReturn(device.id)}>[반납]</button>
                ) : (
                  <span> [대여중] {device.rentedBy.name} ({device.rentedBy.affiliation})</span>
                ))
              ) : device.rentedBy ? (
                <span> [대여중] Unknown (Unknown)</span>
              ) : (
                <button onClick={() => handleRent(device.id)}>[대여]</button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>디바이스 목록이 없습니다.</p>
      )}
    </div>
  );
}

export default Devices;