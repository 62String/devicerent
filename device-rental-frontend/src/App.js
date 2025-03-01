import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [data, setData] = useState(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    if (isLoggedIn) {
      fetchData();
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
      <h1>Data Display</h1>
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
    </div>
  );
}

export default App;