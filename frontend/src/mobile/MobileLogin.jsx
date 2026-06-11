import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../utils/AuthContext';
import { DeviceIcon } from '../components/Icons';

const MobileLogin = () => {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setUser, user } = useAuth();
  const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4000`;

  useEffect(() => {
    if (user) {
      navigate('/mobile/rent');
    }
  }, [user, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await axios.post(`${apiUrl}/api/auth/login`, { id: id.trim(), password });
      localStorage.setItem('token', response.data.token);

      const meResponse = await axios.get(`${apiUrl}/api/me`, {
        headers: { Authorization: `Bearer ${response.data.token}` },
      });
      const userData = meResponse.data.user;
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      navigate('/mobile/rent');
    } catch (err) {
      setError('로그인에 실패했습니다. 아이디와 비밀번호를 확인해 주세요.');
    }
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-5">
      <div className="w-full max-w-[340px]">
        <div className="flex items-center justify-center gap-2 mb-6 text-ink">
          <DeviceIcon size={22} />
          <span className="text-xl font-bold tracking-tight">DeviceRent</span>
        </div>
        <div className="card" style={{ borderTop: '2px solid var(--ink)' }}>
          <div className="p-5">
            <h1 className="text-lg font-bold text-ink mb-1">모바일 로그인</h1>
            <p className="text-xs text-sub mb-5">QR 스캔으로 빠르게 대여/반납하세요</p>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleLogin}>
              <label className="field-label" htmlFor="m-login-id">아이디</label>
              <input
                id="m-login-id"
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="아이디 입력"
                required
                className="input w-full mb-3"
              />
              <label className="field-label" htmlFor="m-login-pw">비밀번호</label>
              <input
                id="m-login-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                required
                className="input w-full mb-5"
              />
              <button type="submit" className="btn btn-ink w-full">로그인</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileLogin;
