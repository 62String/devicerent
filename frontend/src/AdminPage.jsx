import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function AdminPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [error, setError] = useState(null);
  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    if (!token) {
      navigate('/login', { state: { message: 'No token found' } });
      return;
    }

    const fetchCurrentUser = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const userData = response.data.user;
        console.log('AdminPage user data:', userData);
        if (!userData) {
          navigate('/login', { state: { message: 'User data not found' } });
          return;
        }
        if (!userData.isAdmin) {
          navigate('/devices', { state: { message: 'Admin access required' } });
          return;
        }
        setCurrentUser(userData);
      } catch (error) {
        console.error('Error fetching current user:', error);
        navigate('/login', { state: { message: 'Invalid token or session expired' } });
      }
    };

    fetchCurrentUser();
  }, [token, navigate]);

  const syncData = async () => {
    try {
      const response = await axios.post(`${apiUrl}/api/sync`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Sync response:', response.data);
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