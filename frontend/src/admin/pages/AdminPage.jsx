import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import { DownloadIcon } from '../../components/Icons';

function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [downloadLink, setDownloadLink] = useState('');
  const [lastRetentionCheck, setLastRetentionCheck] = useState(null);
  const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4000`;
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/devices');
    }
  }, [user, navigate]);

  const checkRetentionData = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/devices/history/check-retention`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.status === 200) {
        if (response.data.hasRetentionData) {
          setMessage('2년 초과 데이터가 존재합니다. 서버에서 자동으로 익스포트 및 삭제됩니다.');
          setLastRetentionCheck(true);
        } else if (lastRetentionCheck === true) {
          const latestExport = await axios.get(`${apiUrl}/api/devices/history/exports`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const recentExport = latestExport.data[0];
          if (recentExport && new Date(recentExport.timestamp) > new Date(Date.now() - 10000)) {
            setDownloadLink(`${apiUrl}${recentExport.filePath}`);
            setMessage('2년 초과 데이터가 자동으로 익스포트 및 삭제되었습니다. 아래 링크에서 다운로드하세요.');
          } else {
            setMessage('2년 초과 데이터가 없습니다.');
          }
          setLastRetentionCheck(false);
        } else {
          setMessage('2년 초과 데이터가 없습니다.');
        }
      }
    } catch (error) {
      setMessage('2년 초과 데이터 확인 중 오류 발생');
    }
  };

  const handleRetentionExport = async () => {
    try {
      const response = await axios.post(`${apiUrl}/api/devices/history/export-retention`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.status === 200) {
        if (response.data.filePath) {
          setDownloadLink(response.data.filePath);
          setMessage('2년 지난 히스토리 데이터가 익스포트되고 DB에서 삭제되었습니다. 아래 링크에서 다운로드하세요.');
          setLastRetentionCheck(false);
        } else {
          setMessage(response.data.message || '2년 초과 데이터가 없습니다.');
        }
      }
    } catch (error) {
      if (error.response && error.response.status !== 200) {
        const errorMessage = error.response?.data?.message || '2년 초과 데이터 처리 중 오류 발생';
        setMessage(errorMessage);
      }
    }
  };

  useEffect(() => {
    checkRetentionData();
    const interval = setInterval(checkRetentionData, 10000);
    return () => clearInterval(interval);
  }, [token, lastRetentionCheck]);

  const menuItems = [
    { title: '사용자 목록', desc: '전체 사용자 조회 · 권한 관리', path: '/admin/users' },
    { title: '승인 대기 목록', desc: '가입 신청 승인 / 거절', path: '/admin/pending' },
    { title: '디바이스 관리', desc: '디바이스 등록 · 상태 관리', path: '/devices/manage' },
    { title: '익스포트 내역', desc: '엑셀 익스포트 기록 조회', path: '/admin/export-history' },
  ];

  const isInfo = message === '2년 초과 데이터가 없습니다.';

  return (
    <div className="min-h-screen bg-paper">
      <div className="page-wrap">
        <h1 className="page-title">관리자</h1>
        <p className="page-sub">사용자와 디바이스, 데이터 보존 정책을 관리합니다</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 mb-6">
          {menuItems.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="card p-5 text-left cursor-pointer transition-colors hover:border-hint"
            >
              <div className="text-sm font-bold text-ink">{item.title}</div>
              <div className="text-xs text-sub mt-1">{item.desc}</div>
            </button>
          ))}
        </div>

        <div className="card" style={{ borderTop: '2px solid var(--ink)' }}>
          <div className="p-5">
            <div className="text-sm font-bold text-ink">데이터 보존 정책</div>
            <p className="text-xs text-sub mt-1 mb-4">
              2년이 지난 대여 히스토리는 엑셀로 익스포트한 뒤 DB에서 삭제합니다. 10초마다 자동 확인됩니다.
            </p>
            {message && (
              <div className={`alert ${isInfo ? 'alert-success' : 'alert-error'}`}>{message}</div>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={handleRetentionExport} className="btn btn-ink">
                <DownloadIcon size={14} />
                2년 초과 데이터 수동 익스포트
              </button>
              {downloadLink && (
                <a href={downloadLink} download className="link text-sm">익스포트된 파일 다운로드</a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminPage;
