import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getApiUrl } from '../../utils/api';
import { XIcon } from '../../components/Icons';

const TYPE_LABEL = {
  os_change: 'OS 변경',
  repair_needed: '수리 필요',
};

const STATUS_LABEL = {
  pending: { label: '승인 대기', className: 'badge badge-warn' },
  approved: { label: '승인 완료', className: 'badge badge-ok' },
  rejected: { label: '반려', className: 'badge badge-neutral' },
};

const DEVICE_STATUS_LABEL = {
  active: '활성',
  repair: '수리 필요',
  inactive: '비활성',
};

const formatCurrentValue = (type, value) => {
  if (!value) return 'N/A';
  if (type === 'os_change') return `${value.osName || ''} ${value.osVersion || ''}`.trim() || 'N/A';
  if (type === 'repair_needed') {
    const status = DEVICE_STATUS_LABEL[value.status] || value.status || 'N/A';
    return value.statusReason ? `${status} · ${value.statusReason}` : status;
  }
  return String(value);
};

const formatProposedValue = (type, value) => {
  if (!value) return 'N/A';
  if (type === 'os_change') return `${value.osName || ''} ${value.osVersion || ''}`.trim() || 'N/A';
  if (type === 'repair_needed') return DEVICE_STATUS_LABEL[value.status] || '수리 필요';
  return String(value);
};

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
};

function DeviceChangeRequests({ embedded = false, onChanged }) {
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState('pending');
  const [message, setMessage] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [actionType, setActionType] = useState('');
  const [busy, setBusy] = useState(false);
  const apiUrl = getApiUrl();
  const token = localStorage.getItem('token');

  const fetchRequests = async () => {
    try {
      const query = status === 'all' ? '' : `?status=${status}`;
      const response = await axios.get(`${apiUrl}/api/devices/change-requests${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequests(response.data || []);
    } catch (error) {
      setMessage(error.response?.data?.message || '제보 목록 조회 실패');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [status]);

  const openReviewModal = (request, action) => {
    setSelectedRequest(request);
    setActionType(action);
    setReviewNote('');
  };

  const closeReviewModal = () => {
    setSelectedRequest(null);
    setActionType('');
    setReviewNote('');
    setBusy(false);
  };

  const submitReview = async () => {
    if (!selectedRequest || !actionType) return;
    setBusy(true);
    try {
      await axios.post(`${apiUrl}/api/devices/change-requests/${selectedRequest._id}/${actionType}`, {
        reviewNote,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage(actionType === 'approve' ? '제보를 승인했습니다.' : '제보를 반려했습니다.');
      setTimeout(() => setMessage(''), 3000);
      closeReviewModal();
      fetchRequests();
      onChanged?.();
    } catch (error) {
      setMessage(error.response?.data?.message || '처리 실패');
      setTimeout(() => setMessage(''), 3000);
      setBusy(false);
    }
  };

  return (
    <div className={embedded ? '' : 'min-h-screen bg-paper'}>
      <div className={embedded ? '' : 'page-wrap'} style={embedded ? undefined : { maxWidth: 1200 }}>
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            {embedded ? (
              <>
                <div className="text-sm font-bold text-ink">디바이스 제보</div>
                <div className="text-xs text-sub mt-1">OS 변경과 수리 필요 요청을 검토합니다</div>
              </>
            ) : (
              <>
                <h1 className="page-title">디바이스 제보 승인</h1>
                <p className="page-sub">사용자가 제보한 OS 변경과 수리 필요 요청을 검토합니다</p>
              </>
            )}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[
              ['pending', '승인 대기'],
              ['approved', '승인 완료'],
              ['rejected', '반려'],
              ['all', '전체'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={`btn btn-sm ${status === value ? 'btn-ink' : 'btn-outline'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {message && (
          <div className={`alert mt-5 ${message.includes('실패') ? 'alert-error' : 'alert-success'}`}>{message}</div>
        )}

        <div className="card overflow-x-auto mt-5">
          <table className="table-note" style={{ tableLayout: 'fixed', minWidth: 1040 }}>
            <thead>
              <tr>
                <th style={{ width: 92 }}>시리얼</th>
                <th style={{ width: 150 }}>디바이스</th>
                <th style={{ width: 90 }}>유형</th>
                <th style={{ width: 120 }}>현재값</th>
                <th style={{ width: 140 }}>제안값</th>
                <th>사유</th>
                <th style={{ width: 96 }}>제보자</th>
                <th style={{ width: 110 }}>상태</th>
                <th style={{ width: 160 }}>처리자 / 메모</th>
              </tr>
            </thead>
            <tbody>
              {requests.length > 0 ? requests.map((request) => {
                const statusBadge = STATUS_LABEL[request.status] || STATUS_LABEL.pending;
                return (
                  <tr key={request._id}>
                    <td className="td-mono">{request.serialNumber}</td>
                    <td>
                      <div className="cell-main truncate" title={request.modelName}>{request.modelName || 'N/A'}</div>
                      <div className="cell-sub">{request.osName} {request.osVersion}</div>
                    </td>
                    <td><span className="badge badge-neutral">{TYPE_LABEL[request.requestType] || request.requestType}</span></td>
                    <td className="td-sub truncate" title={formatCurrentValue(request.requestType, request.currentValue)}>
                      {formatCurrentValue(request.requestType, request.currentValue)}
                    </td>
                    <td className="td-sub truncate" title={formatProposedValue(request.requestType, request.proposedValue)}>
                      {formatProposedValue(request.requestType, request.proposedValue)}
                    </td>
                    <td className="td-sub truncate" title={request.reason || ''}>{request.reason || '—'}</td>
                    <td>
                      <div className="cell-main">{request.submittedBy?.name || '알 수 없음'}</div>
                      <div className="cell-sub">{formatDate(request.createdAt)}</div>
                    </td>
                    <td><span className={statusBadge.className}>{statusBadge.label}</span></td>
                    <td className="text-right">
                      {request.status === 'pending' ? (
                        <div className="flex gap-1.5 justify-end">
                          <button className="btn btn-primary btn-sm" onClick={() => openReviewModal(request, 'approve')}>승인</button>
                          <button className="btn btn-outline btn-sm" onClick={() => openReviewModal(request, 'reject')}>반려</button>
                        </div>
                      ) : (
                        <div className="text-right">
                          <div className="td-sub text-xs">{request.reviewedBy?.name || '—'}</div>
                          {request.reviewNote && (
                            <div className="cell-sub truncate" title={request.reviewNote}>{request.reviewNote}</div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="9" className="text-center text-sub py-8">표시할 제보가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selectedRequest && (
          <div className="modal-overlay" onClick={closeReviewModal}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <div className="modal-title">{actionType === 'approve' ? '제보 승인' : '제보 반려'}</div>
                  <div className="text-xs text-sub mt-0.5">
                    <span className="td-mono">{selectedRequest.serialNumber}</span> · {TYPE_LABEL[selectedRequest.requestType]}
                  </div>
                </div>
                <button className="icon-btn" aria-label="닫기" onClick={closeReviewModal}><XIcon size={14} /></button>
              </div>
              <div className="modal-body">
                <div className="modal-note mb-3">
                  <div className="field-label">변경 내용</div>
                  <div className="text-sm">
                    {formatCurrentValue(selectedRequest.requestType, selectedRequest.currentValue)}
                    {' → '}
                    <b>{formatProposedValue(selectedRequest.requestType, selectedRequest.proposedValue)}</b>
                  </div>
                </div>
                <label className="field-label">처리 메모</label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  className="input w-full resize-none"
                  rows={3}
                  placeholder="처리 메모를 입력하세요"
                />
              </div>
              <div className="modal-foot">
                <button onClick={closeReviewModal} className="btn btn-outline">취소</button>
                <button onClick={submitReview} className={actionType === 'approve' ? 'btn btn-primary' : 'btn btn-danger'} disabled={busy}>
                  {busy ? '처리 중...' : actionType === 'approve' ? '승인' : '반려'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DeviceChangeRequests;
