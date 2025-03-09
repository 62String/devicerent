import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

function Devices() {
  const [devices, setDevices] = useState([]);
  const [currentUser, setCurrentUser] = useState({ name: '', affiliation: '', isAdmin: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  console.log('API URL:', apiUrl);

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
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Fetch response:', response.data);
      setDevices(response.data.devices || response.data);
    } catch (error) {
      console.error('Error fetching devices:', error);
      console.log('Error response:', error.response?.data);
      setError(error.response?.data?.message || 'Failed to fetch devices');
      if (error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Fetched user data from /me:', response.data); // 디버깅 로그
      const userData = response.data.user || response.data;
      console.log('Setting currentUser with:', userData); // 추가 로그
      setCurrentUser(prev => ({
        ...prev,
        name: userData.name || '',
        affiliation: userData.affiliation || '',
        isAdmin: userData.isAdmin || false,
        isPending: userData.isPending || false
      }));
    } catch (error) {
      console.error('Error fetching current user:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      }
    }
  }, [token, navigate]);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const init = async () => {
      let decodedAdmin = false;
      try {
        const decoded = jwtDecode(token);
        console.log('Decoded token:', decoded); // 디버깅 로그
        decodedAdmin = decoded.isAdmin || false;
        setCurrentUser(prev => ({
          ...prev,
          isAdmin: decodedAdmin
        }));
      } catch (error) {
        console.error('Error decoding token:', error);
      }

      await fetchCurrentUser(); // 순차 실행
      fetchDevices();
    };
    init();
  }, [fetchDevices, fetchCurrentUser, token, navigate]);

  const handleRent = async (deviceId) => {
    try {
      console.log('Renting device with ID:', deviceId);
      const response = await axios.post(`${apiUrl}/api/devices/rent-device`, { deviceId: Number(deviceId) }, {
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
      const response = await axios.post(`${apiUrl}/api/devices/return-device`, { deviceId: Number(deviceId) }, {
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
      {console.log('Render - currentUser:', currentUser, 'isAdmin:', currentUser.isAdmin)}
      <div>
        {currentUser.isAdmin ? (
          <button onClick={() => navigate('/admin')}>관리자 페이지</button>
        ) : (
          <span>관리자 권한이 없습니다.</span>
        )}
      </div>
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