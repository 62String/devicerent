import React, { useState, useEffect } from 'react';
import axios from 'axios';

const DeviceHistory = () => {
  const [historyPairs, setHistoryPairs] = useState([]);
  const [originalHistoryPairs, setOriginalHistoryPairs] = useState([]);
  const [devices, setDevices] = useState([]);
  const [searchSerial, setSearchSerial] = useState('');
  const [error, setError] = useState(null);
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    if (!token) {
      setError('토큰이 없습니다. 로그인 해 주세요.');
      return;
    }
    let isMounted = true;

    const fetchData = async () => {
      try {
        const devicesResponse = await axios.get(`${apiUrl}/api/devices`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Fetched devices:', devicesResponse.data);
        if (isMounted) setDevices(devicesResponse.data || []);

        const historyResponse = await axios.get(`${apiUrl}/api/devices/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Fetched history:', historyResponse.data);
        if (isMounted && historyResponse.data && Array.isArray(historyResponse.data)) {
          const sortedHistory = historyResponse.data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          const rentMap = new Map();
          sortedHistory.forEach(record => {
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
          const pairs = Array.from(rentMap.values())
            .map(pair => {
              const serial = pair.rent?.serialNumber || pair.return.serialNumber;
              const device = devices.find(d => d.serialNumber === serial);
              return {
                serialNumber: serial,
                modelName: device?.modelName || 'N/A',
                osName: device?.osName || 'N/A',
                osVersion: device?.osVersion || 'N/A',
                rentTime: pair.rent ? new Date(pair.rent.timestamp).toLocaleString() : 'N/A',
                returnTime: pair.return ? new Date(pair.return.timestamp).toLocaleString() : 'N/A',
                userId: pair.rent?.userId || pair.return.userId,
                userDetails: pair.rent?.userDetails || pair.return.userDetails,
              };
            })
            .sort((a, b) => {
              const aTime = a.rentTime !== 'N/A' ? new Date(a.rentTime) : new Date(a.returnTime);
              const bTime = b.rentTime !== 'N/A' ? new Date(b.rentTime) : new Date(b.returnTime);
              return bTime - aTime;
            });
          setHistoryPairs(pairs);
          setOriginalHistoryPairs(pairs);
        } else if (isMounted) {
          setHistoryPairs([]);
          setOriginalHistoryPairs([]);
        }
      } catch (err) {
        if (isMounted) {
          setError('데이터를 불러오지 못했습니다. 서버를 확인해 주세요.');
          console.error('Error fetching data:', err);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [token]); // apiUrl 제거

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
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{record.userDetails?.name || '알 수 없음'}</td>
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