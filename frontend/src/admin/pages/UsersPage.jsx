import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { SearchIcon, XIcon } from '../../components/Icons';
import { getApiUrl } from '../../utils/api';
import { useAuth } from '../../utils/AuthContext';

const ROLE_LEVEL_OPTIONS = [
  { value: 0, label: '레벨 0 · 마스터 관리자' },
  { value: 1, label: '레벨 1 · 운영 관리자' },
  { value: 2, label: '레벨 2 · 대시보드 조회' },
  { value: 99, label: '일반 사용자' },
];

const getRoleLevelLabel = (roleLevel) =>
  ROLE_LEVEL_OPTIONS.find(option => option.value === Number(roleLevel))?.label || '일반 사용자';

function UsersPage() {
  const { user: currentUser } = useAuth();
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
  const [draftRoleLevels, setDraftRoleLevels] = useState({});
  const [roleChangeTarget, setRoleChangeTarget] = useState(null);
  const [roleChangeReason, setRoleChangeReason] = useState('');
  const [isRoleChanging, setIsRoleChanging] = useState(false);
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
      setDraftRoleLevels(Object.fromEntries(fetchedUsers.map(user => [user.id, Number(user.roleLevel)])));
    } catch (err) {
      setError(err.response?.data?.message || '사용자 목록을 불러오는데 실패했습니다.');
    }
  };

  const filteredUsers = users.filter(user =>
    user.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.affiliation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(user.roleLevel ?? '').includes(searchTerm)
  );

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (!sortField) return 0;
    const aValue = a[sortField];
    const bValue = b[sortField];
    if (typeof aValue === 'number' || typeof bValue === 'number') {
      return sortOrder === 'asc' ? Number(aValue ?? 99) - Number(bValue ?? 99) : Number(bValue ?? 99) - Number(aValue ?? 99);
    }
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
      setMessage(err.response?.data?.message || '삭제 실패');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const openRoleChangeModal = (targetUser) => {
    const nextRoleLevel = Number(draftRoleLevels[targetUser.id]);
    if (nextRoleLevel === Number(targetUser.roleLevel)) {
      setMessage('현재와 다른 관리레벨을 선택해주세요.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    setRoleChangeTarget({ ...targetUser, nextRoleLevel });
    setRoleChangeReason('');
  };

  const closeRoleChangeModal = () => {
    setRoleChangeTarget(null);
    setRoleChangeReason('');
  };

  const handleRoleChange = async () => {
    if (!roleChangeTarget || isRoleChanging) return;
    try {
      setIsRoleChanging(true);
      const response = await axios.post(`${apiUrl}/api/admin/users/role-level`, {
        id: roleChangeTarget.id,
        roleLevel: roleChangeTarget.nextRoleLevel,
        reason: roleChangeReason
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const updatedUser = response.data.user;
      setUsers(prev => prev.map(user => user.id === updatedUser.id ? { ...user, ...updatedUser } : user));
      setDraftRoleLevels(prev => ({ ...prev, [updatedUser.id]: Number(updatedUser.roleLevel) }));
      setMessage(response.data.message);
      setTimeout(() => setMessage(''), 3000);
      closeRoleChangeModal();
    } catch (err) {
      setMessage(err.response?.data?.message || '관리레벨 변경 실패');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setIsRoleChanging(false);
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
              placeholder="아이디, 이름, 소속, 관리레벨 검색"
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
                    <th className="cursor-pointer select-none" onClick={() => handleSort('roleLevel')}>관리레벨{sortIndicator('roleLevel')}</th>
                    <th style={{ width: 260 }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {currentUsers.map(u => (
                    <tr key={u.id}>
                      <td className="td-mono">{u.id}</td>
                      <td className="cell-main">{u.name || 'N/A'}</td>
                      <td className="td-sub">{u.affiliation || 'N/A'}</td>
                      <td className="td-sub">{getRoleLevelLabel(u.roleLevel)}</td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          <select
                            className="input py-1.5"
                            style={{ minWidth: 150 }}
                            value={draftRoleLevels[u.id] ?? Number(u.roleLevel)}
                            onChange={(e) => setDraftRoleLevels(prev => ({ ...prev, [u.id]: Number(e.target.value) }))}
                            disabled={u.id === currentUser?.id}
                            aria-label={`${u.name || u.id} 관리레벨`}
                          >
                            {ROLE_LEVEL_OPTIONS.map(option => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => openRoleChangeModal(u)}
                            className="btn btn-sm btn-primary"
                            disabled={u.id === currentUser?.id || Number(draftRoleLevels[u.id]) === Number(u.roleLevel)}
                          >
                            변경
                          </button>
                        <button
                          onClick={() => openDeleteModal(u.id)}
                          className="btn btn-sm"
                          disabled={u.id === currentUser?.id}
                          style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)' }}
                        >
                          삭제
                        </button>
                        </div>
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

        {roleChangeTarget && (
          <div className="modal-overlay" onClick={closeRoleChangeModal}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <div className="modal-title">관리레벨 변경</div>
                  <div className="text-xs text-sub mt-0.5">
                    {roleChangeTarget.name || roleChangeTarget.id} · <span className="td-mono">{roleChangeTarget.id}</span>
                  </div>
                </div>
                <button className="icon-btn" aria-label="닫기" onClick={closeRoleChangeModal}><XIcon size={14} /></button>
              </div>
              <div className="modal-body">
                <div className="text-sm mb-4">
                  <strong>{getRoleLevelLabel(roleChangeTarget.roleLevel)}</strong>에서{' '}
                  <strong>{getRoleLevelLabel(roleChangeTarget.nextRoleLevel)}</strong>(으)로 변경합니다.
                </div>
                <label className="field-label">변경 사유 <span className="text-hint">(선택)</span></label>
                <textarea
                  value={roleChangeReason}
                  onChange={(e) => setRoleChangeReason(e.target.value)}
                  placeholder="권한 변경 사유를 입력하세요"
                  className="input w-full resize-none"
                  rows={3}
                />
              </div>
              <div className="modal-foot">
                <button onClick={closeRoleChangeModal} className="btn btn-outline" disabled={isRoleChanging}>취소</button>
                <button onClick={handleRoleChange} className="btn btn-primary" disabled={isRoleChanging}>
                  {isRoleChanging ? '변경 중...' : '변경 확정'}
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
