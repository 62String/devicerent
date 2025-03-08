import React, { useState, useEffect } from 'react';
import axios from 'axios';

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/admin/users`, { // 수정
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(response.data || []); // 수정: 백엔드에서 배열 직접 반환
      } catch (err) {
        setError(err.response?.data?.message || '사용자 목록을 불러오는데 실패했습니다.');
        console.error('Fetch users error:', err);
      }
    };
    fetchUsers();
  }, [token]);

  return (
    <div>
      <h2>사용자 관리</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {users.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>ID</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>이름</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>소속</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>승인 대기</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{user.id}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{user.name || 'N/A'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{user.affiliation || 'N/A'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{user.isPending ? '예' : '아니오'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>사용자가 없습니다.</p>
      )}
    </div>
  );
}

export default UsersPage;