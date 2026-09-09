import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './utils/AuthContext';
import { getApiUrl } from './utils/api';
import { getTheme, toggleTheme } from './utils/theme';
import { DeviceIcon, MoonIcon, SunIcon } from './components/Icons';

function Login() {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [microsoftEnabled, setMicrosoftEnabled] = useState(false);
  const [theme, setTheme] = useState(getTheme());
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const apiUrl = getApiUrl();
  const themeToggleTitle = theme === 'dark' ? '라이트모드' : '다크모드';

  useEffect(() => {
    let mounted = true;
    axios.get(`${apiUrl}/api/auth/microsoft/config`)
      .then((response) => {
        if (mounted) setMicrosoftEnabled(Boolean(response.data?.enabled));
      })
      .catch(() => {
        if (mounted) setMicrosoftEnabled(false);
      });
    return () => {
      mounted = false;
    };
  }, [apiUrl]);

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
      navigate('/portal');
    } catch (error) {
      setError(error.response?.data?.message || '로그인에 실패했습니다.');
    }
  };

  const handleMicrosoftLogin = () => {
    window.location.href = `${apiUrl}/api/auth/microsoft/start?redirect=/portal`;
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <div className="flex justify-end p-4">
        <button
          type="button"
          className="icon-btn"
          aria-label={`${themeToggleTitle} 전환`}
          title={themeToggleTitle}
          onClick={() => setTheme(toggleTheme())}
        >
          {theme === 'dark' ? <SunIcon size={15} /> : <MoonIcon size={15} />}
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-24">
        <div className="w-full max-w-[380px]">
          <div className="flex items-center justify-center gap-2 mb-6 text-ink">
            <DeviceIcon size={22} />
            <span className="text-xl font-bold tracking-tight">DeviceRent</span>
          </div>
          <div className="card" style={{ borderTop: '2px solid var(--ink)' }}>
            <div className="p-6">
              <h1 className="text-lg font-bold text-ink mb-1">로그인</h1>
              <p className="text-xs text-sub mb-5">디바이스 대여 시스템에 오신 것을 환영합니다</p>
              {error && <div role="alert" className="alert alert-error">{error}</div>}
              <form onSubmit={handleLogin}>
                <label className="field-label" htmlFor="login-id">아이디</label>
                <input
                  id="login-id"
                  type="text"
                  value={id}
                  onChange={(e) => setId(e.target.value.trim())}
                  placeholder="아이디 입력"
                  required
                  className="input w-full mb-3"
                />
                <label className="field-label" htmlFor="login-pw">비밀번호</label>
                <input
                  id="login-pw"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  required
                  className="input w-full mb-5"
                />
                <button type="submit" className="btn btn-ink w-full">로그인</button>
              </form>
              <div className="flex items-center gap-2 my-4">
                <div className="h-px flex-1 bg-line" />
                <span className="text-[11px] text-hint">또는</span>
                <div className="h-px flex-1 bg-line" />
              </div>
              <button
                type="button"
                className="btn btn-outline w-full"
                onClick={handleMicrosoftLogin}
                disabled={!microsoftEnabled}
                title={microsoftEnabled ? 'Microsoft 365 계정으로 로그인' : 'Microsoft Entra ID 설정 후 활성화됩니다'}
              >
                Microsoft 365 계정으로 로그인
              </button>
              {!microsoftEnabled && (
                <p className="text-[11px] text-hint mt-2">
                  Entra ID 앱 등록 정보가 설정되면 활성화됩니다.
                </p>
              )}
            </div>
          </div>
          <p className="text-center text-xs text-sub mt-4">
            계정이 없나요? <Link to="/register" className="link">가입 신청</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
