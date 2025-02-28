import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [devices, setDevices] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false); // 업데이트 중 상태

  useEffect(() => {
    if (token) {
      fetchDevices(); // 별도 함수로 분리
    }
  }, [token]);

  const fetchDevices = async () => {
    try {
      const response = await fetch('http://localhost:3003/devices', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('디바이스 로드 실패');
      const data = await response.json();
      setDevices(data);
    } catch (err) {
      console.error('디바이스 로드 에러:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await fetch('http://localhost:3003/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) throw new Error('로그인 실패');
      const data = await response.json();
      setToken(data.token);
    } catch (err) {
      setError('아이디 또는 비밀번호가 잘못되었습니다.');
    }
  };

  const updateDeviceStatus = async (id, newStatus) => {
    if (!token || isUpdating) return;
    setIsUpdating(true);
    try {
      const response = await fetch('http://localhost:3003/devices/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!response.ok) throw new Error('상태 업데이트 실패');
      const data = await response.json();
      setDevices(data.devices); // 즉시 상태 업데이트
      await fetchDevices(); // 백엔드 최신 데이터 다시 가져오기
    } catch (err) {
      console.error('상태 업데이트 에러:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="App">
      <h1>로그인</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="아이디"
        />
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            {showPassword ? '숨기기' : '보기'}
          </button>
        </div>
        <button type="submit">로그인</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {token && (
        <div>
          <p>토큰: {token}</p>
          <h2>디바이스 목록</h2>
          <table>
            <thead>
              <tr>
                <th>이름</th>
                <th>상태</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {devices.map(device => (
                <tr key={device.id}>
                  <td>{device.name}</td>
                  <td>{device.status}</td>
                  <td>
                    <button
                      onClick={() => updateDeviceStatus(device.id, device.status === '대여 가능' ? '대여 중' : '대여 가능')}
                      disabled={isUpdating || (device.rentedBy && device.rentedBy !== 'test')}
                    >
                      {device.status === '대여 가능' ? '대여' : '반납'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;