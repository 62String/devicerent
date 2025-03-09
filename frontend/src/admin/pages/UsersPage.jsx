import React, { useState, useEffect } from 'react';
import axios from 'axios';

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const [reason, setReason] = useState('');
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Users response:', response.data); // 디버깅 로그
      setUsers(response.data.users || []);
      if (response.data.users.length === 0) {
        setMessage('표시할 사용자가 없습니다.');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setMessage(error.response?.data?.message || '사용자 목록을 불러오는데 실패했습니다.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('삭제하시겠습니까? (예, 아니오)')) {
      try {
        const response = await axios.post(`${apiUrl}/api/admin/users/delete`, { id, reason }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessage(response.data.message);
        setTimeout(() => setMessage(''), 3000);
        setDeleteId('');
        setReason('');
        fetchUsers();
      } catch (error) {
        setMessage(error.response?.data?.message || '삭제 실패');
        setTimeout(() => setMessage(''), 3000);
        console.error('Delete error:', error);
      }
    }
  };

  return (
    <div>
      <h2>사용자 목록</h2>
      {message && <div style={{ color: message.includes('실패') ? 'red' : 'green', marginBottom: '10px' }}>{message}</div>}
      {users.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>ID</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>이름</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>소속</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>직급</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>액션</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{user.id}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{user.name || 'N/A'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{user.affiliation || 'N/A'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{user.position || 'N/A'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  <button onClick={() => { setDeleteId(user.id); setReason(''); }}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>사용자가 없습니다.</p>
      )}
      {deleteId && (
        <div style={{ marginTop: '10px' }}>
          <label>삭제 사유: </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="삭제 사유를 입력하세요"
            style={{ padding: '5px', width: '200px' }}
          />
          <button onClick={() => handleDelete(deleteId)}>확인</button>
          <button onClick={() => { setDeleteId(''); setReason(''); }}>취소</button>
        </div>
      )}
    </div>
  );
}

export default UsersPage;