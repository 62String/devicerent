import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { XIcon } from '../../components/Icons';
import { getApiUrl } from '../../utils/api';

function PendingUsersPage() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const token = localStorage.getItem('token');
  const apiUrl = getApiUrl();

  useEffect(() => {
    const fetchPendingUsers = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/admin/users/pending`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPendingUsers(response.data.users || []);
      } catch (err) {
        setError(err.response?.data?.message || '승인 대기 목록을 불러오는데 실패했습니다.');
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
    }
  };

  const openApproveModal = (id) => {
    setSelectedUserId(id);
    setShowApproveModal(true);
  };

  const closeApproveModal = () => {
    setShowApproveModal(false);
    setSelectedUserId(null);
  };

  const confirmApprove = () => {
    handleApprove(selectedUserId);
    closeApproveModal();
  };

  const openRejectModal = (id) => {
    setSelectedUserId(id);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const closeRejectModal = () => {
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
    }
  };

  const isErrorMessage = message.includes('실패') || message.includes('입력해주세요');

  return (
    <div className="min-h-screen bg-paper">
      <div className="page-wrap">
        <div className="flex items-center gap-2.5">
          <h1 className="page-title">승인 대기</h1>
          {pendingUsers.length > 0 && (
            <span className="badge badge-warn" style={{ fontSize: 12, padding: '3px 10px' }}>{pendingUsers.length}건</span>
          )}
        </div>
        <p className="page-sub">가입 신청을 검토하고 승인하거나 거부합니다</p>

        {error && <div className="alert alert-error mt-5">{error}</div>}
        {message && (
          <div className={`alert mt-5 ${isErrorMessage ? 'alert-error' : 'alert-success'}`}>{message}</div>
        )}

        <div className="mt-5">
          {pendingUsers.length > 0 ? (
            <div className="card overflow-x-auto">
              <table className="table-note" style={{ minWidth: 560 }}>
                <thead>
                  <tr>
                    <th>아이디</th>
                    <th>이름</th>
                    <th>소속</th>
                    <th>직급</th>
                    <th style={{ width: 140 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUsers.map(u => (
                    <tr key={u.id}>
                      <td className="td-mono">{u.id}</td>
                      <td className="cell-main">{u.name || 'N/A'}</td>
                      <td className="td-sub">{u.affiliation || 'N/A'}</td>
                      <td className="td-sub">{u.position || 'N/A'}</td>
                      <td className="text-right">
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => openApproveModal(u.id)} className="btn btn-primary btn-sm">승인</button>
                          <button
                            onClick={() => openRejectModal(u.id)}
                            className="btn btn-sm"
                            style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)' }}
                          >
                            거부
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card p-10 text-center text-sub text-sm">승인 대기 중인 사용자가 없습니다.</div>
          )}
        </div>

        {showApproveModal && (
          <div className="modal-overlay" onClick={closeApproveModal}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <div className="modal-title">가입 승인</div>
                  <div className="text-xs text-sub mt-0.5">
                    <span className="td-mono">{selectedUserId}</span> 사용자를 승인하시겠습니까?
                  </div>
                </div>
                <button className="icon-btn" aria-label="닫기" onClick={closeApproveModal}><XIcon size={14} /></button>
              </div>
              <div className="modal-foot pt-4">
                <button onClick={closeApproveModal} className="btn btn-outline">취소</button>
                <button onClick={confirmApprove} className="btn btn-primary">승인</button>
              </div>
            </div>
          </div>
        )}

        {showRejectModal && (
          <div className="modal-overlay" onClick={closeRejectModal}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <div className="modal-title">가입 거부</div>
                  <div className="text-xs text-sub mt-0.5"><span className="td-mono">{selectedUserId}</span></div>
                </div>
                <button className="icon-btn" aria-label="닫기" onClick={closeRejectModal}><XIcon size={14} /></button>
              </div>
              <div className="modal-body">
                <label className="field-label">거부 사유</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="거부 사유를 입력하세요"
                  className="input w-full resize-none"
                  rows={3}
                />
              </div>
              <div className="modal-foot">
                <button onClick={closeRejectModal} className="btn btn-outline">취소</button>
                <button onClick={handleReject} className="btn btn-danger">거부</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PendingUsersPage;
