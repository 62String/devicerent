import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [data, setData] = useState(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [devices, setDevices] = useState([]); // 디바이스 목록 상태 추가
  const [currentUser, setCurrentUser] = useState(null); // 현재 사용자 정보 추가

  useEffect(() => {
    if (isLoggedIn) {
      fetchData();
      fetchDevices(); // 로그인 후 디바이스 목록 가져오기
      fetchCurrentUser(); // 현재 사용자 정보 가져오기
    }
  }, [isLoggedIn]);

  const login = async () => {
    try {
      const response = await axios.post('http://localhost:4000/api/login', { username, password });
      setToken(response.data.token);
      setIsLoggedIn(true);
      setUsername('');
      setPassword('');
    } catch (error) {
      console.error('Login error:', error);
      alert('Invalid credentials');
    }
  };

  const fetchData = async () => {
    try {
      const response = await axios.get('http://localhost:4000/api/data', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchDevices = async () => {
    try {
      const response = await axios.get('http://localhost:4000/api/devices', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDevices(response.data.devices);
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
      const response = await axios.post('http://localhost:4000/api/sync', data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
      setIsPopupOpen(true);
    } catch (error) {
      console.error('Error syncing data:', error);
    }
  };

  const handleRent = async (deviceId) => {
    try {
      const response = await axios.post('http://localhost:4000/api/rent-device', 
        { deviceId }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(response.data.message);
      // 디바이스 목록 갱신
      setDevices(devices.map(device => 
        device.id === deviceId ? { ...device, rentedBy: currentUser, rentedAt: new Date() } : device
      ));
    } catch (error) {
      alert(error.response.data.message);
    }
  };

  const handleReturn = async (deviceId) => {
    try {
      const response = await axios.post('http://localhost:4000/api/return-device', 
        { deviceId }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(response.data.message);
      // 디바이스 목록 갱신
      setDevices(devices.map(device => 
        device.id === deviceId ? { ...device, rentedBy: null, rentedAt: null } : device
      ));
    } catch (error) {
      alert(error.response.data.message);
    }
  };

  if (!isLoggedIn) {
    return (
      <div>
        <h1>Login</h1>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={login}>Login</button>
      </div>
    );
  }

  return (
    <div>
      <h1>Device Rental System</h1>
      {/* 기존 데이터 표시 */}
      {data && (
        <table border="1">
          <thead>
            <tr>
              <th>ID</th>
              <th>Device Info</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{data.id}</td>
              <td>{data.deviceInfo}</td>
            </tr>
          </tbody>
        </table>
      )}
      <button onClick={syncData}>데이터 동기화</button>
      {isPopupOpen && (
        <div className="popup">
          <p>데이터가 성공적으로 동기화되었습니다!</p>
          <button onClick={() => setIsPopupOpen(false)}>닫기</button>
        </div>
      )}

      {/* 디바이스 목록 추가 */}
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

export default App;
