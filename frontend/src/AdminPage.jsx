import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function AdminPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [error, setError] = useState(null);
  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'; // 환경 변수 정의

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await axios.get('${apiUrl}/api/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const user = response.data.user;
        setCurrentUser(user);
        if (!user.isAdmin) {
          navigate('/devices'); // 관리자가 아니면 디바이스 목록 페이지로 리다이렉트
        }
      } catch (error) {
        console.error('Error fetching current user:', error);
        navigate('/login'); // 토큰 오류 시 로그인 페이지로 리다이렉트
      }
    };
    fetchCurrentUser();
  }, [token, navigate]);

  const syncData = async () => {
    try {
      await axios.post('${apiUrl}/api/sync', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsPopupOpen(true);
      setError(null);
    } catch (error) {
      console.error('Error syncing data:', error);
      setError(error.response?.data?.message || 'Sync failed');
    }
  };

  if (!currentUser) return <p>Loading...</p>;

  return (
    <div>
      <h1>Admin Page</h1>
      <button onClick={() => navigate('/devices')}>디바이스 목록으로 돌아가기</button>
      <button onClick={syncData}>데이터 동기화</button>
      {isPopupOpen && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#fff', padding: '20px', border: '1px solid #ccc' }}>
          <p>데이터가 성공적으로 동기화되었습니다!</p>
          <button onClick={() => setIsPopupOpen(false)}>닫기</button>
        </div>
      )}
      {error && <p style={{ color: 'red', fontWeight: 'bold' }}>{error}</p>}
    </div>
  );
}

export default AdminPage;