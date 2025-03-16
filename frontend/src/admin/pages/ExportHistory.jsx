import React, { useState, useEffect } from 'react';
import axios from 'axios';

function ExportHistory() {
  const [exports, setExports] = useState([]);
  const [loading, setLoading] = useState(false);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  const token = localStorage.getItem('token');

  const fetchExportHistory = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${apiUrl}/api/devices/history/exports`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExports(response.data);
    } catch (error) {
      console.error('Error fetching export history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExportHistory();
  }, []);

  return (
    <div>
      <h1>익스포트 내역</h1>
      {loading ? (
        <p>로딩 중...</p>
      ) : exports.length === 0 ? (
        <p>익스포트 내역이 없습니다.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>익스포트 시간</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>파일 경로</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>레코드 수</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>삭제된 레코드 수</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>수행자</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>다운로드</th>
            </tr>
          </thead>
          <tbody>
            {exports.map(exp => (
              <tr key={exp._id}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{new Date(exp.timestamp).toLocaleString()}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{exp.filePath}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{exp.recordCount}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{exp.deletedCount}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{exp.performedBy}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  <a href={`${apiUrl}${exp.filePath}`} download style={{ color: '#2196F3', textDecoration: 'underline' }}>
                    다운로드
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default ExportHistory;