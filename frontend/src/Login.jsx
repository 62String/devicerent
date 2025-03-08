import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'; // 환경 변수 정의

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    console.log('Sending login request:', { id, password });
    try {
      const response = await axios.post(`${apiUrl}/api/auth/login`, { id, password }); // /api/auth/login
      console.log('Login response:', response.data);
      localStorage.setItem('token', response.data.token);
      console.log('Token saved:', response.data.token);
      navigate('/devices');
    } catch (error) {
      console.log('Login error details:', error.response?.data || error.message);
      setError(error.response?.data?.message || 'Login failed');
      console.error('Login error:', error);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '20px' }}>
      <h2>Login</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleLogin}>
        <input
          type="text"
          placeholder="ID"
          value={id}
          onChange={(e) => setId(e.target.value.trim())} // trim 적용
          required
          style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
        />
        <button type="submit" style={{ padding: '10px 20px' }}>
          Login
        </button>
      </form>
      <p>
        계정이 없나요? <a href="/register">Register here</a>
      </p>
    </div>
  );
}

export default Login;