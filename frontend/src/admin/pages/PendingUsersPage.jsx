import React, { useState, useEffect } from 'react';
import axios from 'axios';

function PendingUsersPage() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [rejectReason, setRejectReason] = useState(''); // 거부 사유
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    const fetchPendingUsers = async () => {
      console.log('Fetching from:', `${apiUrl}/api/admin/users/pending`);
      try {
        const response = await axios.get(`${apiUrl}/api/admin/users/pending`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Response data:', response.data);
        setPendingUsers(response.data.users || []);
      } catch (err) {
        setError(err.response?.data?.message || '승인 대기 목록을 불러오는데 실패했습니다.');
        console.error('Fetch pending users error:', err);
      }
    };
    fetchPendingUsers();
  }, [token]);

  const handleApprove = async (id) => {
    try {
      const response = await axios.post(`${apiUrl}/api/admin/users/approve`, { id }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage(response.data.message);
      setTimeout(() => setMessage(''), 3000);
      setPendingUsers(pendingUsers.filter(user => user.id !== id));
    } catch (err) {
      setMessage('승인 실패');
      setTimeout(() => setMessage(''), 3000);
      console.error('Approve error:', err);
    }
  };

  const handleReject = async (id) => {
    if (!rejectReason) {
      setMessage('거부 사유를 입력해주세요.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    try {
      const response = await axios.post(`${apiUrl}/api/admin/users/reject`, { id, reason: rejectReason }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage(response.data.message);
      setTimeout(() => setMessage(''), 3000);
      setPendingUsers(pendingUsers.filter(user => user.id !== id));
      setRejectReason(''); // 사유 초기화
    } catch (err) {
      setMessage('거부 실패');
      setTimeout(() => setMessage(''), 3000);
      console.error('Reject error:', err);
    }
  };

  return (
    <div>
      <h2>승인 대기 목록</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {message && <div style={{ color: 'green', marginBottom: '10px' }}>{message}</div>}
      {pendingUsers.length > 0 ? (
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
            {pendingUsers.map(user => (
              <tr key={user.id}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{user.id}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{user.name || 'N/A'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{user.affiliation || 'N/A'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{user.position || 'N/A'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  <button onClick={() => handleApprove(user.id)}>승인</button>
                  <button onClick={() => handleReject(user.id)}>거부</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>승인 대기 중인 사용자가 없습니다.</p>
      )}
      <div style={{ marginTop: '10px' }}>
        <label>거부 사유: </label>
        <input
          type="text"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="거부 사유를 입력하세요"
          style={{ padding: '5px', width: '200px' }}
        />
      </div>
    </div>
  );
}

export default PendingUsersPage;