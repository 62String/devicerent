import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';

function UsersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const usersPerPage = 50; // 50개로 설정
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4000`;

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const fetchUsers = async () => {
    console.log('Fetching users from:', `${apiUrl}/api/admin/users`);
    try {
      const response = await axios.get(`${apiUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Users response - Raw data:', response.data);
      const fetchedUsers = response.data.users || response.data || [];
      console.log('Fetched users:', fetchedUsers);
      setUsers(fetchedUsers);
    } catch (err) {
      setError(err.response?.data?.message || '사용자 목록을 불러오는데 실패했습니다.');
      console.error('Fetch users error:', err.response?.status, err.response?.data || err.message);
    }
  };

  const filteredUsers = users.filter(user =>
    user.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.affiliation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.position?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (!sortField) return 0;
    const aValue = a[sortField];
    const bValue = b[sortField];
    if (aValue == null) return sortOrder === 'asc' ? 1 : -1;
    if (bValue == null) return sortOrder === 'asc' ? -1 : 1;
    return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
  });

  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = sortedUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

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
      setMessage('상위 직급은 삭제 불가입니다. (하극상?)');
      setTimeout(() => setMessage(''), 3000);
      console.error('Delete error:', err.response?.status, err.response?.data || err.message);
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
        <h2 className="text-2xl font-semibold text-gray-700 mb-4 text-center">사용자 목록</h2>
        {error && <div className="text-red-500 text-center mb-4 bg-red-100 p-2 rounded">❌ {error}</div>}
        {message && (
          <div className={`text-center mb-4 p-2 rounded ${message.includes('실패') || message.includes('불가') || message.includes('입력해주세요') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message.includes('실패') || message.includes('불가') || message.includes('입력해주세요') ? '❌' : '✅'} {message}
          </div>
        )}
        <div className="mb-6 flex flex-wrap gap-2 justify-center">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="검색..."
            className="p-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {users.length > 0 ? (
          <div className="overflow-x-auto mx-auto max-w-[1024px]">
            <table className="min-w-full border-collapse bg-white shadow-md rounded-lg">
              <thead>
                <tr className="bg-blue-50">
                  {['id', 'name', 'affiliation', 'position', '액션'].map((header) => (
                    <th
                      key={header}
                      className="border border-gray-200 p-1 text-left font-medium text-gray-700 cursor-pointer min-w-[100px] max-w-[200px] whitespace-normal"
                      onClick={() => {
                        if (sortField === header) {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField(header);
                          setSortOrder('asc');
                        }
                      }}
                    >
                      {header === '액션' ? '액션' : header.charAt(0).toUpperCase() + header.slice(1)} {sortField === header && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentUsers.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="border border-gray-200 p-1 whitespace-normal">{user.id}</td>
                    <td className="border border-gray-200 p-1 whitespace-normal">{user.name || 'N/A'}</td>
                    <td className="border border-gray-200 p-1 whitespace-normal">{user.affiliation || 'N/A'}</td>
                    <td className="border border-gray-200 p-1 whitespace-normal">{user.position || 'N/A'}</td>
                    <td className="border border-gray-200 p-1">
                      <button
                        onClick={() => openDeleteModal(user.id)}
                        className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className={`px-3 py-1 rounded ${currentPage === 1 ? 'bg-gray-300 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}
                disabled={currentPage === 1}
              >
                이전
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`px-3 py-1 rounded ${currentPage === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className={`px-3 py-1 rounded ${currentPage === totalPages ? 'bg-gray-300 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}
                disabled={currentPage === totalPages}
              >
                다음
              </button>
            </div>
          </div>
        ) : (
          <p className="text-gray-600 text-center">등록된 사용자가 없습니다.</p>
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
    </div>
  );
}

export default UsersPage;