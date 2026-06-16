import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './utils/AuthContext';
import { getApiUrl } from './utils/api';
import { AlertTriangleIcon, PlaneIcon, CheckCircleIcon, ClockIcon } from './components/Icons';

const isTeamLeadOrAbove = (u) => ['팀장', '실장', '센터장'].includes(u?.position);

const formatElapsed = (hours) => {
  if (hours == null) return '—';
  if (hours >= 24) return `${Math.floor(hours / 24)}일`;
  return `${hours}시간`;
};

const formatOs = (osName, osVersion) => {
  if (!osName && !osVersion) return 'N/A';
  if (!osVersion) return osName;
  if (!osName || osVersion.toLowerCase().startsWith(osName.toLowerCase())) return osVersion;
  return `${osName} ${osVersion}`;
};

const formatTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const apiUrl = getApiUrl();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${apiUrl}/api/devices/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || '대시보드를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="min-h-screen bg-paper">
        <div className="page-wrap"><div className="card p-10 text-center text-sub text-sm">불러오는 중...</div></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-paper">
        <div className="page-wrap"><div className="alert alert-error mt-5">{error || '데이터가 없습니다.'}</div></div>
      </div>
    );
  }

  const { counts, osDistribution, statusDistribution, rentedDevices = [], recentActivity = [] } = data;
  const overdueList = rentedDevices.filter(d => d.overdue);
  const approvedList = rentedDevices.filter(d => d.rentalType === 'longterm' && d.longTermStatus === 'approved');
  const totalOs = Object.values(osDistribution).reduce((a, b) => a + b, 0) || 1;
  const teamLead = isTeamLeadOrAbove(user);

  const STATUS_LABEL = { active: '활성', repair: '수리중', inactive: '비활성' };

  return (
    <div className="min-h-screen bg-paper">
      <div className="page-wrap" style={{ maxWidth: 1200 }}>
        <h1 className="page-title">대여 현황 대시보드</h1>
        <p className="page-sub">디바이스 보유·대여 상태를 한눈에 확인하세요</p>

        {/* KPI */}
        <div className="grid gap-2 mt-5 mb-3" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          <div className="stat-card"><div className="stat-card-label">전체 보유</div><div className="stat-card-value">{counts.total}</div></div>
          <div className="stat-card" style={{ borderTop: '3px solid var(--ok)', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
            <div className="stat-card-label">대여 가능</div><div className="stat-card-value" style={{ color: 'var(--ok)' }}>{counts.available}</div>
          </div>
          <div className="stat-card" style={{ borderTop: '3px solid var(--warn)', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
            <div className="stat-card-label">대여중</div><div className="stat-card-value" style={{ color: 'var(--warn)' }}>{counts.rented}</div>
          </div>
          <div className="stat-card"><div className="stat-card-label">장기대여(승인)</div><div className="stat-card-value" style={{ color: 'var(--sub)' }}>{counts.longtermApproved}</div></div>
          <div className="stat-card" style={{ borderTop: '3px solid var(--danger)', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
            <div className="stat-card-label">장기 미반납</div><div className="stat-card-value" style={{ color: 'var(--danger)' }}>{counts.overdue}</div>
          </div>
        </div>

        {/* 승인 대기 배너 */}
        {counts.pendingApproval > 0 && (
          <div className="alert alert-warn flex items-center gap-2.5" style={{ marginBottom: 14 }}>
            <ClockIcon size={16} />
            <span className="flex-1 text-[12px]">
              <b>장기대여 승인 대기 {counts.pendingApproval}건</b> — 팀장 이상 검토가 필요합니다.
            </span>
            {teamLead && (
              <button className="btn btn-sm" style={{ background: 'var(--warn-text)', color: 'var(--surface)' }} onClick={() => navigate('/longterm/approvals')}>
                승인 대기 보기 →
              </button>
            )}
          </div>
        )}

        <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
          {/* 장기 미반납 · 회수 필요 */}
          <div className="card" style={{ border: '1px solid var(--danger)' }}>
            <div className="flex items-center justify-between" style={{ padding: '11px 14px', borderBottom: '2px solid var(--danger)' }}>
              <span className="flex items-center gap-1.5 text-sm font-bold" style={{ color: 'var(--danger-text)' }}>
                <AlertTriangleIcon size={15} /> 장기 미반납 · 회수 필요
              </span>
              <span className="badge badge-danger">{overdueList.length}건</span>
            </div>
            <div className="text-[11px] text-sub px-3.5 pt-2">일반대여 72시간 초과 또는 미승인 장기대여 72시간 초과 — 승인된 장기대여는 제외</div>
            {overdueList.length === 0 ? (
              <div className="p-8 text-center text-sub text-sm">회수가 필요한 디바이스가 없습니다.</div>
            ) : (
              <table className="table-note" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>시리얼</th>
                    <th>모델 / 대여자</th>
                    <th style={{ width: 80 }}>유형</th>
                    <th style={{ width: 56, textAlign: 'right' }}>경과</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueList.map(d => {
                    const pendingLong = d.rentalType === 'longterm' && d.longTermStatus === 'pending';
                    return (
                      <tr key={d.serialNumber} style={{ background: 'var(--danger-bg)' }}>
                        <td className="td-mono">{d.serialNumber}</td>
                        <td>
                          <div className="cell-main truncate" title={d.modelName}>{d.modelName}</div>
                          <div className="cell-sub">{d.renterName} · {d.affiliation || 'N/A'}</div>
                        </td>
                        <td><span className={pendingLong ? 'badge badge-danger' : 'badge badge-neutral'}>{pendingLong ? '미승인' : '일반'}</span></td>
                        <td style={{ textAlign: 'right', color: 'var(--danger-text)', fontWeight: 700 }}>{formatElapsed(d.elapsedHours)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* 우측: 분포 + 최근활동 */}
          <div className="flex flex-col gap-3">
            <div className="card">
              <div className="text-sm font-bold text-ink" style={{ padding: '11px 14px', borderBottom: '2px solid var(--ink)' }}>OS · 상태 분포</div>
              <div className="p-3.5">
                {Object.entries(osDistribution).map(([os, n]) => (
                  <div key={os} className="mb-2.5">
                    <div className="flex justify-between text-[11px] text-sub mb-1"><span>{os}</span><span className="font-medium text-ink">{n}</span></div>
                    <div style={{ height: 8, borderRadius: 4, background: 'var(--line-soft)', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round((n / totalOs) * 100)}%`, height: '100%', background: os.toLowerCase().includes('ios') ? 'var(--accent)' : 'var(--ok)' }} />
                    </div>
                  </div>
                ))}
                <div className="flex gap-1.5 text-[11px] mt-3">
                  {['active', 'repair', 'inactive'].map(s => (
                    <span key={s} className={`flex-1 text-center badge ${s === 'active' ? 'badge-ok' : s === 'repair' ? 'badge-warn' : 'badge-neutral'}`} style={{ padding: '5px 0' }}>
                      <b>{statusDistribution[s] || 0}</b> {STATUS_LABEL[s]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="card">
              <div className="text-sm font-bold text-ink" style={{ padding: '11px 14px', borderBottom: '2px solid var(--ink)' }}>최근 활동</div>
              <div className="px-3.5 py-1.5">
                {recentActivity.length === 0 ? (
                  <div className="text-sub text-[12px] py-3">최근 활동이 없습니다.</div>
                ) : recentActivity.slice(0, 6).map((a, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5" style={{ borderBottom: i < Math.min(recentActivity.length, 6) - 1 ? '1px solid var(--line-soft)' : 'none' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: a.action === 'return' ? 'var(--ok)' : 'var(--warn)' }} />
                    <span className="flex-1 text-[11.5px] text-ink">{a.action === 'return' ? '반납' : '대여'} <span className="td-mono">{a.serialNumber}</span> · {a.userName}</span>
                    <span className="text-[11px] text-hint">{formatTime(a.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 장기대여 현황 (승인 완료) */}
        <div className="card">
          <div className="flex items-center justify-between" style={{ padding: '11px 14px', borderBottom: '2px solid var(--line)' }}>
            <span className="flex items-center gap-1.5 text-sm font-bold text-sub"><PlaneIcon size={15} /> 장기대여 현황 (승인 완료)</span>
            <span className="badge badge-ok flex items-center gap-1"><CheckCircleIcon size={12} /> 승인됨</span>
          </div>
          {approvedList.length === 0 ? (
            <div className="p-8 text-center text-sub text-sm">승인된 장기대여가 없습니다.</div>
          ) : (
            <table className="table-note" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>시리얼</th>
                  <th>모델 / 대여자</th>
                  <th style={{ width: 90 }}>승인자</th>
                  <th style={{ width: 56, textAlign: 'right' }}>경과</th>
                </tr>
              </thead>
              <tbody>
                {approvedList.map(d => (
                  <tr key={d.serialNumber}>
                    <td className="td-mono">{d.serialNumber}</td>
                    <td>
                      <div className="cell-main truncate" title={d.modelName}>{d.modelName}</div>
                      <div className="cell-sub">{d.renterName} · {d.affiliation || 'N/A'} · {formatOs(d.osName, d.osVersion)}</div>
                    </td>
                    <td className="td-sub">{d.approvedBy || '—'}</td>
                    <td className="td-sub" style={{ textAlign: 'right' }}>{formatElapsed(d.elapsedHours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
