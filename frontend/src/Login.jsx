import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(''); // 2초 후 에러 메시지 초기화
      }, 2000);
      return () => clearTimeout(timer); // 컴포넌트 언마운트 시 타이머 정리
    }
  }, [error]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    console.log('apiUrl:', apiUrl);
    console.log('Sending login request to:', `${apiUrl}/api/auth/login`);
    console.log('Sending login request:', { id, password });
    try {
      const response = await axios.post(`${apiUrl}/api/auth/login`, { id: id.trim(), password });
      console.log('Login response:', response.data);
      localStorage.setItem('token', response.data.token);
      console.log('Token saved:', response.data.token);

      // /me 호출로 사용자 정보 가져오기
      const meResponse = await axios.get(`${apiUrl}/api/me`, {
        headers: { Authorization: `Bearer ${response.data.token}` }
      });
      console.log('User info from /me:', meResponse.data);
      localStorage.setItem('user', JSON.stringify(meResponse.data.user)); // 사용자 정보 저장

      console.log('Current token in localStorage:', localStorage.getItem('token'));
      navigate('/devices');
    } catch (error) {
      console.log('Login error details:', error.response?.data || error.message);
      console.log('Login error status:', error.response?.status); // 상태 코드 로그
      setError(error.response?.data?.message || '로그인에 실패했습니다.');
      console.error('Login error:', error);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '20px' }}>
      <h2>로그인</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleLogin}>
        <div>
          <label>아이디:</label>
          <input
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value.trim())}
            placeholder="아이디"
            required
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          />
        </div>
        <div>
          <label>비밀번호:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            required
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          />
        </div>
        <button type="submit" style={{ padding: '10px 20px' }}>로그인</button>
      </form>
      <p>
        계정이 없나요? <a href="/register">등록하기</a>
      </p>
    </div>
  );
}

export default Login;