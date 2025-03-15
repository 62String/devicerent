import React, { useState, useEffect } from 'react';
import axios from 'axios';

function PendingUsersPage() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    const fetchPendingUsers = async () => {
      console.log('Fetching pending users from:', `${apiUrl}/api/admin/users/pending`);
      try {
        const response = await axios.get(`${apiUrl}/api/admin/users/pending`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Pending users response:', response.data);
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
      console.log('Approving user with ID:', id);
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

  const openRejectModal = (id) => {
    console.log('Opening reject modal for user ID:', id);
    setSelectedUserId(id);
    setRejectReason(''); // 모달 열 때마다 초기화
    setShowRejectModal(true);
  };

  const closeRejectModal = () => {
    console.log('Closing reject modal');
    setShowRejectModal(false);
    setSelectedUserId(null);
    setRejectReason('');
  };

  const handleReject = async () => {
    if (!rejectReason) {
      setMessage('거부 사유를 입력해주세요.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    try {
      console.log('Rejecting user with ID:', selectedUserId, 'Reason:', rejectReason);
      const response = await axios.post(`${apiUrl}/api/admin/users/reject`, { id: selectedUserId, reason: rejectReason }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage(response.data.message);
      setTimeout(() => setMessage(''), 3000);
      setPendingUsers(pendingUsers.filter(user => user.id !== selectedUserId));
      closeRejectModal();
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
                  <button onClick={() => openRejectModal(user.id)} style={{ marginLeft: '10px' }}>거부</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>승인 대기 중인 사용자가 없습니다.</p>
      )}

      {showRejectModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{
            backgroundColor: 'white', padding: '20px', borderRadius: '5px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)', width: '400px', textAlign: 'center'
          }}>
            <h3>거부 사유 입력</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="거부 사유를 입력하세요"
              style={{ width: '100%', height: '80px', padding: '5px', margin: '10px 0', resize: 'none' }}
            />
            <div>
              <button
                onClick={handleReject}
                style={{ marginRight: '10px', padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
              >
                확인
              </button>
              <button
                onClick={closeRejectModal}
                style={{ padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PendingUsersPage;