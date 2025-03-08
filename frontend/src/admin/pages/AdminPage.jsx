import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

function AdminPage() {
  const [currentUser, setCurrentUser] = useState(null);
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

  if (!currentUser) return <p>Loading...</p>;

  return (
    <div>
      <h1>Admin Page</h1>
      <nav>
        <ul>
          <li><Link to="sync">데이터 동기화</Link></li>
          {/* 미래 확장: <li><Link to="users">사용자 관리</Link></li> */}
        </ul>
      </nav>
    </div>
  );
}

export default AdminPage;