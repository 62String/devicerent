import React, { useState, useEffect } from 'react';
import axios from 'axios';

const DeviceHistory = () => {
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/devices/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHistory(response.data);
      setError(null);
    } catch (err) {
      setError('대여 히스토리를 불러오지 못했습니다. 서버를 확인해 주세요.');
      console.error('Error fetching device history:', err);
    }
  };

  return (
    <div>
      <h2>대여 히스토리</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!error && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>시리얼 번호</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>사용자 ID</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>이름</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>소속</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>동작</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>시간</th>
            </tr>
          </thead>
          <tbody>
            {history.map((record, index) => (
              <tr key={index}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{record.serialNumber}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{record.userId}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{record.userDetails.name}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{record.userDetails.affiliation}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{record.action}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{new Date(record.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default DeviceHistory;