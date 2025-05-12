import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';

function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [downloadLink, setDownloadLink] = useState('');
  const [lastRetentionCheck, setLastRetentionCheck] = useState(null);
  const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4000`;
console.log('AdminPage - apiUrl:', apiUrl);
  const token = localStorage.getItem('token');

  // 관리자 권한 확인
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

  const handleNavigate = (path) => () => navigate(path);

  useEffect(() => {
    checkRetentionData();
    const interval = setInterval(checkRetentionData, 10000);
    return () => clearInterval(interval);
  }, [token, lastRetentionCheck]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto p-4 max-w-4xl">
        <h2 className="text-2xl font-semibold text-gray-700 mb-4 text-center">관리자 페이지</h2>
        {message && (
          <div className={message === '2년 초과 데이터가 없습니다.' ? 'text-center mb-4' : 'bg-red-100 p-3 rounded-md mb-4 text-center'}>
            <strong className={message === '2년 초과 데이터가 없습니다.' ? 'text-gray-700' : 'text-red-700'}>알림:</strong>{' '}
            <span className={message === '2년 초과 데이터가 없습니다.' ? 'text-gray-700' : 'text-gray-700'}>{message}</span>
          </div>
        )}
        {downloadLink && (
          <div className="mb-4 text-center">
            <a href={downloadLink} download className="text-blue-600 underline hover:text-blue-800">
              익스포트된 파일 다운로드
            </a>
          </div>
        )}
        <table className="mx-auto border-collapse bg-white shadow-md rounded-lg">
          <tbody>
            <tr>
              <td className="p-2">
                <button
                  onClick={handleRetentionExport}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 w-full"
                >
                  2년 초과 데이터 익스포트 (수동)
                </button>
              </td>
              <td className="p-2">
                <button
                  onClick={handleNavigate('/admin/users')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 w-full"
                >
                  사용자 목록
                </button>
              </td>
              <td className="p-2">
                <button
                  onClick={handleNavigate('/admin/pending')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 w-full"
                >
                  승인 대기 목록
                </button>
              </td>
              <td className="p-2">
                <button
                  onClick={handleNavigate('/admin/export-history')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 w-full"
                >
                  익스포트 내역 보기
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminPage;