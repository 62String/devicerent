import React, { useState, useEffect } from 'react';
import axios from 'axios';

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    const fetchUsers = async () => {
      console.log('Fetching users from:', `${apiUrl}/api/admin/users`);
      try {
        const response = await axios.get(`${apiUrl}/api/admin/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Users response - Raw data:', response.data); // 전체 응답 데이터
        const fetchedUsers = response.data.users || response.data || []; // users 키 확인
        console.log('Fetched users:', fetchedUsers);
        setUsers(fetchedUsers);
      } catch (err) {
        setError(err.response?.data?.message || '사용자 목록을 불러오는데 실패했습니다.');
        console.error('Fetch users error:', err.response?.status, err.response?.data || err.message);
      }
    };
    fetchUsers();
  }, [token]);

  const openDeleteModal = (id) => {
    console.log('Opening delete modal for user ID:', id);
    setSelectedUserId(id);
    setDeleteReason('');
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    console.log('Closing delete modal');
    setShowDeleteModal(false);
    setSelectedUserId(null);
    setDeleteReason('');
  };

  const handleDelete = async () => {
    if (!deleteReason) {
      setMessage('삭제 사유를 입력해주세요.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    try {
      console.log('Deleting user with ID:', selectedUserId, 'Reason:', deleteReason);
      const response = await axios.post(`${apiUrl}/api/admin/users/delete`, { id: selectedUserId, reason: deleteReason }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage(response.data.message);
      setTimeout(() => setMessage(''), 3000);
      setUsers(users.filter(user => user.id !== selectedUserId));
      closeDeleteModal();
    } catch (err) {
      setMessage('삭제 실패');
      setTimeout(() => setMessage(''), 3000);
      console.error('Delete error:', err.response?.status, err.response?.data || err.message);
    }
  };

  return (
    <div>
      <h2>사용자 목록</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {message && <div style={{ color: 'green', marginBottom: '10px' }}>{message}</div>}
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
                  <button onClick={() => openDeleteModal(user.id)}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>등록된 사용자가 없습니다.</p>
      )}

      {showDeleteModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{
            backgroundColor: 'white', padding: '20px', borderRadius: '5px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)', width: '400px', textAlign: 'center'
          }}>
            <h3>삭제 사유 입력</h3>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="삭제 사유를 입력하세요"
              style={{ width: '100%', height: '80px', padding: '5px', margin: '10px 0', resize: 'none' }}
            />
            <div>
              <button
                onClick={handleDelete}
                style={{ marginRight: '10px', padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
              >
                확인
              </button>
              <button
                onClick={closeDeleteModal}
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

export default UsersPage;