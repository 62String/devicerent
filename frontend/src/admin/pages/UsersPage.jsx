import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { SearchIcon, XIcon } from '../../components/Icons';
import { getApiUrl } from '../../utils/api';

function UsersPage() {
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
  const usersPerPage = 50;
  const token = localStorage.getItem('token');
  const apiUrl = getApiUrl();

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const fetchedUsers = response.data.users || response.data || [];
      setUsers(fetchedUsers);
    } catch (err) {
      setError(err.response?.data?.message || '사용자 목록을 불러오는데 실패했습니다.');
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
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / usersPerPage));

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortIndicator = (field) =>
    sortField === field ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : '';

  const openDeleteModal = (id) => {
    setSelectedUserId(id);
    setDeleteReason('');
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
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
      const response = await axios.post(`${apiUrl}/api/admin/users/delete`, { id: selectedUserId, reason: deleteReason }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage(response.data.message);
      setTimeout(() => setMessage(''), 3000);
      setUsers(users.filter(user => user.id !== selectedUserId));
      closeDeleteModal();
    } catch (err) {
      setMessage('상위 직급은 삭제 불가입니다.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const isErrorMessage = message.includes('실패') || message.includes('불가') || message.includes('입력해주세요');

  return (
    <div className="min-h-screen bg-paper">
      <div className="page-wrap">
        <h1 className="page-title">사용자 목록</h1>
        <p className="page-sub">등록된 사용자를 조회하고 관리합니다</p>

        {error && <div className="alert alert-error mt-5">{error}</div>}
        {message && (
          <div className={`alert mt-5 ${isErrorMessage ? 'alert-error' : 'alert-success'}`}>{message}</div>
        )}

        <div className="flex gap-2 mt-5 mb-4">
          <div className="relative flex-1 max-w-[320px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-hint pointer-events-none">
              <SearchIcon size={14} />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="아이디, 이름, 소속, 직급 검색"
              className="input w-full pl-9"
            />
          </div>
        </div>

        {users.length > 0 ? (
          <>
            <div className="card overflow-x-auto">
              <table className="table-note" style={{ minWidth: 560 }}>
                <thead>
                  <tr>
                    <th className="cursor-pointer select-none" onClick={() => handleSort('id')}>아이디{sortIndicator('id')}</th>
                    <th className="cursor-pointer select-none" onClick={() => handleSort('name')}>이름{sortIndicator('name')}</th>
                    <th className="cursor-pointer select-none" onClick={() => handleSort('affiliation')}>소속{sortIndicator('affiliation')}</th>
                    <th className="cursor-pointer select-none" onClick={() => handleSort('position')}>직급{sortIndicator('position')}</th>
                    <th style={{ width: 70 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {currentUsers.map(u => (
                    <tr key={u.id}>
                      <td className="td-mono">{u.id}</td>
                      <td className="cell-main">{u.name || 'N/A'}</td>
                      <td className="td-sub">{u.affiliation || 'N/A'}</td>
                      <td className="td-sub">{u.position || 'N/A'}</td>
                      <td className="text-right">
                        <button
                          onClick={() => openDeleteModal(u.id)}
                          className="btn btn-sm"
                          style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)' }}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-1.5 mt-4">
                <button
                  className="pg-btn"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i + 1}
                    className={`pg-btn ${currentPage === i + 1 ? 'pg-btn-active' : ''}`}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  className="pg-btn"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  ›
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="card p-10 text-center text-sub text-sm">등록된 사용자가 없습니다.</div>
        )}

        {showDeleteModal && (
          <div className="modal-overlay" onClick={closeDeleteModal}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <div className="modal-title">사용자 삭제</div>
                  <div className="text-xs text-sub mt-0.5"><span className="td-mono">{selectedUserId}</span></div>
                </div>
                <button className="icon-btn" aria-label="닫기" onClick={closeDeleteModal}><XIcon size={14} /></button>
              </div>
              <div className="modal-body">
                <label className="field-label">삭제 사유</label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="삭제 사유를 입력하세요"
                  className="input w-full resize-none"
                  rows={3}
                />
              </div>
              <div className="modal-foot">
                <button onClick={closeDeleteModal} className="btn btn-outline">취소</button>
                <button onClick={handleDelete} className="btn btn-danger">삭제</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UsersPage;
