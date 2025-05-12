import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';

function PendingUsersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4000`;

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

  const openApproveModal = (id) => {
    console.log('Opening approve modal for user ID:', id);
    setSelectedUserId(id);
    setShowApproveModal(true);
  };

  const closeApproveModal = () => {
    console.log('Closing approve modal');
    setShowApproveModal(false);
    setSelectedUserId(null);
  };

  const confirmApprove = () => {
    handleApprove(selectedUserId);
    closeApproveModal();
  };

  const openRejectModal = (id) => {
    console.log('Opening reject modal for user ID:', id);
    setSelectedUserId(id);
    setRejectReason('');
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
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-900 text-white p-4">
        <h1 className="text-3xl font-bold text-center">Device Rental System</h1>
      </header>
      <div className="container mx-auto p-4 max-w-4xl">
        {user && (
          <div className="mb-6 flex flex-wrap gap-2 justify-center">
             {user.isAdmin && (
              <>
                <button onClick={() => navigate('/admin')} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 mr-2">관리자 페이지</button>
                
                <button onClick={() => navigate('/devices/manage')} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 mr-2">디바이스 관리</button>
              </>
            )}
          </div>
        )}
        <h2 className="text-2xl font-semibold text-gray-700 mb-4 text-center">승인 대기 목록</h2>
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        {message && <p className="text-green-600 text-center mb-4">{message}</p>}
        {pendingUsers.length > 0 ? (
          <div className="overflow-x-auto mx-auto max-w-[1024px] flex justify-center">
            <table className="border-collapse bg-white shadow-md rounded-lg table-auto">
              <thead>
                <tr className="bg-blue-50">
                  <th className="border border-gray-200 p-2 text-left font-medium text-gray-700 min-w-[50px] max-w-[100px] whitespace-normal">ID</th>
                  <th className="border border-gray-200 p-2 text-left font-medium text-gray-700 min-w-[70px] max-w-[150px] whitespace-normal">이름</th>
                  <th className="border border-gray-200 p-2 text-left font-medium text-gray-700 min-w-[100px] max-w-[200px] whitespace-normal">소속</th>
                  <th className="border border-gray-200 p-2 text-left font-medium text-gray-700 min-w-[70px] max-w-[150px] whitespace-normal">직급</th>
                  <th className="border border-gray-200 p-2 text-left font-medium text-gray-700 min-w-[120px] max-w-[150px] whitespace-normal">액션</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="border border-gray-200 p-2 whitespace-normal">{user.id}</td>
                    <td className="border border-gray-200 p-2 whitespace-normal">{user.name || 'N/A'}</td>
                    <td className="border border-gray-200 p-2 whitespace-normal">{user.affiliation || 'N/A'}</td>
                    <td className="border border-gray-200 p-2 whitespace-normal">{user.position || 'N/A'}</td>
                    <td className="border border-gray-200 p-2">
                      <button
                        onClick={() => openApproveModal(user.id)}
                        className="px-1 py-0.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors mr-1 text-sm"
                      >
                        승인
                      </button>
                      <button
                        onClick={() => openRejectModal(user.id)}
                        className="px-1 py-0.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                      >
                        거부
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-600 text-center">승인 대기 중인 사용자가 없습니다.</p>
        )}
        {showApproveModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            justifyContent: 'center', alignItems: 'center'
          }}>
            <div style={{
              backgroundColor: 'white', padding: '20px', borderRadius: '5px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)', width: '400px', textAlign: 'center'
            }}>
              <h3>승인하시겠습니까?</h3>
              <div>
                <button
                  onClick={confirmApprove}
                  style={{ marginRight: '10px', padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  예
                </button>
                <button
                  onClick={closeApproveModal}
                  style={{ padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  아니오
                </button>
              </div>
            </div>
          </div>
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
    </div>
  );
}

export default PendingUsersPage;