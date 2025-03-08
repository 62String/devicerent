import React, { useState, useEffect } from 'react';
import axios from 'axios';

function PendingUsersPage() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [error, setError] = useState('');
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    const fetchPendingUsers = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/admin/users/pending`, { // 수정
          headers: { Authorization: `Bearer ${token}` }
        });
        setPendingUsers(response.data.users || []);
      } catch (err) {
        setError(err.response?.data?.message || '승인 대기 목록을 불러오는데 실패했습니다.');
        console.error('Fetch pending users error:', err);
      }
    };
    fetchPendingUsers();
  }, [token]);

  return (
    <div>
      <h2>승인 대기 목록</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {pendingUsers.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>ID</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>이름</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>소속</th>
            </tr>
          </thead>
          <tbody>
            {pendingUsers.map(user => (
              <tr key={user.id}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{user.id}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{user.name || 'N/A'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{user.affiliation || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>승인 대기 중인 사용자가 없습니다.</p>
      )}
    </div>
  );
}

export default PendingUsersPage;