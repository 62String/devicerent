import React, { useState, useEffect } from 'react';
import axios from 'axios';

const DeviceHistory = () => {
  const [historyPairs, setHistoryPairs] = useState([]);
  const [originalHistoryPairs, setOriginalHistoryPairs] = useState([]); // 원본 데이터 저장
  const [devices, setDevices] = useState([]); // 디바이스 정보 저장
  const [searchSerial, setSearchSerial] = useState('');
  const [error, setError] = useState(null);
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  console.log('DeviceHistory token:', token);
  console.log('DeviceHistory apiUrl:', apiUrl);

  useEffect(() => {
    if (!token) {
      setError('토큰이 없습니다. 로그인 해 주세요.');
      return;
    }
    fetchDevices(); // 디바이스 정보 먼저 가져오기
    fetchHistory();
  }, [token]);

  const fetchDevices = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('DeviceHistory fetchDevices response:', response.data);
      setDevices(response.data || []);
    } catch (err) {
      console.error('Error fetching devices:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      console.log('Fetching history from:', `${apiUrl}/api/devices/history`);
      const response = await axios.get(`${apiUrl}/api/devices/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('DeviceHistory fetchHistory response:', response.data);
      if (response.data && Array.isArray(response.data)) {
        // serialNumber별로 rent와 return 쌍 생성
        const rentMap = new Map();
        response.data.forEach(record => {
          if (record.action === 'rent') {
            rentMap.set(record.serialNumber, { rent: record, return: null });
          } else if (record.action === 'return') {
            const rentEntry = rentMap.get(record.serialNumber);
            if (rentEntry) {
              rentEntry.return = record;
            } else {
              rentMap.set(record.serialNumber, { rent: null, return: record });
            }
          }
        });
        const pairs = Array.from(rentMap.values()).map(pair => {
          const device = devices.find(d => d.serialNumber === (pair.rent?.serialNumber || pair.return.serialNumber));
          return {
            serialNumber: pair.rent?.serialNumber || pair.return.serialNumber,
            modelName: device?.modelName || 'N/A',
            osName: device?.osName || 'N/A',
            osVersion: device?.osVersion || 'N/A',
            rentTime: pair.rent ? new Date(pair.rent.timestamp).toLocaleString() : 'N/A',
            returnTime: pair.return ? new Date(pair.return.timestamp).toLocaleString() : 'N/A',
            userId: pair.rent?.userId || pair.return.userId,
            userDetails: pair.rent?.userDetails || pair.return.userDetails,
          };
        });
        setHistoryPairs(pairs);
        setOriginalHistoryPairs(pairs); // 원본 저장
      } else {
        console.warn('Response data is not an array or is empty:', response.data);
        setHistoryPairs([]);
        setOriginalHistoryPairs([]);
      }
      setError(null);
    } catch (err) {
      setError('대여 히스토리를 불러오지 못했습니다. 서버를 확인해 주세요.');
      console.error('Error fetching device history:', err);
      console.error('Error details:', err.response?.data || err.message);
    }
  };

  const handleSearch = () => {
    if (!searchSerial.trim()) {
      setHistoryPairs(originalHistoryPairs);
      return;
    }
    const filtered = originalHistoryPairs.filter(record =>
      record.serialNumber.toLowerCase().includes(searchSerial.toLowerCase())
    );
    setHistoryPairs(filtered);
  };

  const handleReset = () => {
    setSearchSerial('');
    fetchHistory(); // 새로고침
  };

  return (
    <div>
      <h2>대여 히스토리</h2>
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={searchSerial}
          onChange={(e) => setSearchSerial(e.target.value)}
          placeholder="시리얼 번호 검색"
          style={{ padding: '5px', marginRight: '10px' }}
        />
        <button onClick={handleSearch}>검색</button>
        <button onClick={handleReset} style={{ marginLeft: '10px' }}>
          초기화
        </button>
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!error && historyPairs.length === 0 && <p>대여 히스토리가 없습니다.</p>}
      {!error && historyPairs.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>시리얼 번호</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>기기명</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>OS 이름</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>OS 버전</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>대여자</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>대여 시간</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>반납 시간</th>
            </tr>
          </thead>
          <tbody>
            {historyPairs.map((record, index) => (
              <tr key={index}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{record.serialNumber}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{record.modelName}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{record.osName}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{record.osVersion}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{record.userDetails.name}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{record.rentTime}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{record.returnTime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default DeviceHistory;