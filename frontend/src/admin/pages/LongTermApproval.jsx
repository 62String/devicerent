import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getApiUrl } from '../../utils/api';
import { CheckIcon } from '../../components/Icons';

const formatElapsed = (hours) => {
  if (hours == null) return '—';
  if (hours >= 24) return `${Math.floor(hours / 24)}일`;
  return `${hours}시간`;
};

const formatDateTime = (ts) => {
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return { date: `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
};

function LongTermApproval() {
  const token = localStorage.getItem('token');
  const apiUrl = getApiUrl();
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${apiUrl}/api/devices/longterm/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPending(res.data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || '승인 대기 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const act = async (serialNumber, type) => {
    setBusy(serialNumber);
    try {
      const res = await axios.post(`${apiUrl}/api/devices/longterm/${type}`, { serialNumber }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage(res.data.message);
      setTimeout(() => setMessage(''), 3000);
      await fetchPending();
    } catch (err) {
      setMessage(err.response?.data?.message || (type === 'approve' ? '승인 실패' : '거절 실패'));
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setBusy('');
    }
  };

  const isErr = message && (message.includes('실패') || message.includes('부족'));

  return (
    <div className="min-h-screen bg-paper">
      <div className="page-wrap" style={{ maxWidth: 1100 }}>
        <div className="flex items-center gap-2.5">
          <h1 className="page-title">장기대여 승인 대기</h1>
          {pending.length > 0 && <span className="badge badge-danger" style={{ fontSize: 12, padding: '3px 10px' }}>{pending.length}건</span>}
        </div>
        <p className="page-sub">팀장 이상이 검토 후 승인합니다 · 미승인 상태로 3일을 넘기면 장기 미반납 목록에도 표시됩니다</p>

        {error && <div className="alert alert-error mt-5">{error}</div>}
        {message && <div className={`alert mt-5 ${isErr ? 'alert-error' : 'alert-success'}`}>{message}</div>}

        <div className="mt-5">
          {loading ? (
            <div className="card p-10 text-center text-sub text-sm">불러오는 중...</div>
          ) : pending.length === 0 ? (
            <div className="card p-10 text-center text-sub text-sm">승인 대기 중인 장기대여가 없습니다.</div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="table-note" style={{ tableLayout: 'fixed', minWidth: 820 }}>
                <thead>
                  <tr>
                    <th style={{ width: 76 }}>시리얼</th>
                    <th style={{ width: 170 }}>디바이스 / 신청자</th>
                    <th>사유 (특이사항)</th>
                    <th style={{ width: 88 }}>신청일시</th>
                    <th style={{ width: 58 }}>경과</th>
                    <th style={{ width: 140 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map(d => {
                    const dt = formatDateTime(d.rentedAt);
                    return (
                      <tr key={d.serialNumber} style={d.overdue ? { background: 'var(--danger-bg)' } : undefined}>
                        <td className="td-mono">{d.serialNumber}</td>
                        <td>
                          <div className="cell-main truncate" title={d.modelName}>{d.modelName}</div>
                          <div className="cell-sub">{d.renterName} · {d.affiliation || 'N/A'}</div>
                        </td>
                        <td>
                          <div className="td-sub" style={{ lineHeight: 1.5 }}>
                            {d.remark || <span className="td-hint">—</span>}
                            {d.overdue && <span className="badge badge-danger ml-1.5">3일 초과 · 회수 대상</span>}
                          </div>
                        </td>
                        <td className="td-sub">{dt ? <>{dt.date}<div className="cell-sub">{dt.time}</div></> : '—'}</td>
                        <td className="td-sub" style={d.overdue ? { color: 'var(--danger-text)', fontWeight: 700 } : undefined}>{formatElapsed(d.elapsedHours)}</td>
                        <td className="text-right">
                          <div className="flex gap-1.5 justify-end">
                            <button className="btn btn-primary btn-sm" disabled={busy === d.serialNumber} onClick={() => act(d.serialNumber, 'approve')}>
                              <CheckIcon size={13} /> 승인
                            </button>
                            <button className="btn btn-outline btn-sm" disabled={busy === d.serialNumber} onClick={() => act(d.serialNumber, 'reject')}>
                              거절
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="text-[11px] text-hint mt-2.5">
          승인하면 정식 장기대여로 전환됩니다. 거절하면 일반대여로 남아, 기한 초과 시 장기 미반납 목록에 표시됩니다.
        </div>
      </div>
    </div>
  );
}

export default LongTermApproval;
