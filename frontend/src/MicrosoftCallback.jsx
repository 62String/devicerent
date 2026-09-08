import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './utils/AuthContext';
import { getApiUrl } from './utils/api';

function MicrosoftCallback() {
  const [message, setMessage] = useState('Microsoft 로그인 처리 중...');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const apiUrl = getApiUrl();

  useEffect(() => {
    const finishLogin = async () => {
      const error = searchParams.get('error');
      const token = searchParams.get('token');
      const redirect = searchParams.get('redirect') || '/portal';

      if (error) {
        setMessage(error);
        setTimeout(() => navigate('/login', { replace: true }), 2000);
        return;
      }

      if (!token) {
        setMessage('Microsoft 로그인 토큰을 받지 못했습니다.');
        setTimeout(() => navigate('/login', { replace: true }), 2000);
        return;
      }

      try {
        localStorage.setItem('token', token);
        const meResponse = await axios.get(`${apiUrl}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const userData = meResponse.data.user;
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        navigate(redirect.startsWith('/') ? redirect : '/portal', { replace: true });
      } catch (callbackError) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setMessage('Microsoft 로그인 후 사용자 정보를 불러오지 못했습니다.');
        setTimeout(() => navigate('/login', { replace: true }), 2000);
      }
    };

    finishLogin();
  }, [apiUrl, navigate, searchParams, setUser]);

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="card p-8 text-center text-sub text-sm">
        {message}
      </div>
    </div>
  );
}

export default MicrosoftCallback;
