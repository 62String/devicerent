import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../utils/AuthContext';

function AdminPage() {
  const { logout } = useAuth();
  const [message, setMessage] = useState('');
  const [downloadLink, setDownloadLink] = useState('');
  const [lastRetentionCheck, setLastRetentionCheck] = useState(null);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  const token = localStorage.getItem('token');

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
          // 자동 익스포트 완료 후 메시지 갱신
          const latestExport = await axios.get(`${apiUrl}/api/devices/history/exports`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const recentExport = latestExport.data[0];
          if (recentExport && new Date(recentExport.timestamp) > new Date(Date.now() - 10000)) { // 최근 10초 내 익스포트
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
      console.error('Retention check error:', error);
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
      console.error('Retention export error:', error);
      if (error.response && error.response.status !== 200) {
        const errorMessage = error.response?.data?.message || '2년 초과 데이터 처리 중 오류 발생';
        setMessage(errorMessage);
      }
    }
  };

  useEffect(() => {
    checkRetentionData();
    const interval = setInterval(checkRetentionData, 10000); // 10초 간격으로 체크
    return () => clearInterval(interval);
  }, [token]);

  return (
    <div>
      <h1>관리자 페이지</h1>
      {message && (
        <div style={{ backgroundColor: '#ffcccc', padding: '10px', marginBottom: '20px', borderRadius: '5px' }}>
          <strong>알림:</strong> {message}
        </div>
      )}
      {downloadLink && (
        <div style={{ marginBottom: '20px' }}>
          <a href={downloadLink} download style={{ color: '#2196F3', textDecoration: 'underline' }}>
            익스포트된 파일 다운로드
          </a>
        </div>
      )}
      <div style={{ marginBottom: '20px' }}>
        <button onClick={handleRetentionExport} style={{ marginRight: '10px', padding: '10px 20px' }}>
          2년 초과 데이터 익스포트 (수동)
        </button>
        <Link to="/admin/users" style={{ marginRight: '10px' }}>사용자 목록</Link>
        <Link to="/admin/pending" style={{ marginRight: '10px' }}>승인 대기 목록</Link>
        <Link to="/devices/status" style={{ marginRight: '10px' }}>대여 현황</Link>
        <Link to="/devices/history" style={{ marginRight: '10px' }}>대여 히스토리</Link>
        <Link to="/devices/manage" style={{ marginRight: '10px' }}>디바이스 관리</Link>
        <Link to="/admin/export-history" style={{ marginRight: '10px' }}>익스포트 내역 보기</Link>
        <button onClick={logout}>로그아웃</button>
      </div>
    </div>
  );
}

export default AdminPage;