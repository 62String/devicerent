import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../utils/AuthContext';

const MobileLogin = () => {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const apiUrl = import.meta.env.VITE_API_URL;

  // API URL 확인
  if (!apiUrl) {
    throw new Error('REACT_APP_API_URL 환경 변수가 설정되지 않았습니다.');
  }

  // 로그인 상태 → /mobile/rent로 리다이렉트
  useEffect(() => {
    if (user) {
      navigate('/mobile/rent');
    }
  }, [user, navigate]);

  const handleLogin = async () => {
    try {
      const response = await axios.post(`${apiUrl}/api/auth/login`, { id, password });
      const { token } = response.data;
      login(token);
      navigate('/mobile/rent');
    } catch (err) {
      setError('로그인에 실패했습니다. 아이디와 비밀번호를 확인해 주세요.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-2xl mb-4">로그인</h1>
      {error && <p className="text-red-600 mb-2">{error}</p>}
      <input
        type="text"
        value={id}
        onChange={(e) => setId(e.target.value)}
        placeholder="아이디"
        className="p-2 mb-2 border rounded w-3/4"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="비밀번호"
        className="p-2 mb-2 border rounded w-3/4"
      />
      <button
        onClick={handleLogin}
        className="p-2 bg-blue-600 text-white rounded w-3/4"
      >
        로그인
      </button>
    </div>
  );
};

export default MobileLogin;