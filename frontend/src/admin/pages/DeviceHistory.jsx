import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { saveAs } from 'file-saver';

function DeviceHistory() {
  const [historyPairs, setHistoryPairs] = useState([]);
  const [originalPairs, setOriginalPairs] = useState([]);
  const [searchSerial, setSearchSerial] = useState('');
  const [error, setError] = useState(null);
  const [showRemarkModal, setShowRemarkModal] = useState(false); // 상태 추가
  const [selectedRemark, setSelectedRemark] = useState(''); // 상태 추가
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        console.log('Fetching history from:', `${apiUrl}/api/devices/history`);
        const historyResponse = await axios.get(`${apiUrl}/api/devices/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Fetched history data:', historyResponse.data);
        if (isMounted && historyResponse.data && Array.isArray(historyResponse.data)) {
          const sortedHistory = historyResponse.data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          const pairs = [];
          const rentRecords = [];

          sortedHistory.forEach(record => {
            if (record.action === 'rent') {
              rentRecords.push(record);
            } else if (record.action === 'return') {
              const matchingRent = rentRecords.find(rent => 
                rent.serialNumber === record.serialNumber && !rent.matched
              );
              if (matchingRent) {
                pairs.push({
                  serialNumber: record.serialNumber,
                  modelName: record.deviceInfo?.modelName || matchingRent.deviceInfo?.modelName || 'N/A',
                  osName: record.deviceInfo?.osName || matchingRent.deviceInfo?.osName || 'N/A',
                  osVersion: record.deviceInfo?.osVersion || matchingRent.deviceInfo?.osVersion || 'N/A',
                  userDetails: record.userDetails?.name || matchingRent.userDetails?.name || '알 수 없음',
                  rentTime: new Date(matchingRent.timestamp).toLocaleString(),
                  returnTime: new Date(record.timestamp).toLocaleString(),
                  remark: matchingRent.remark || ''
                });
                matchingRent.matched = true;
              } else {
                pairs.push({
                  serialNumber: record.serialNumber,
                  modelName: record.deviceInfo?.modelName || 'N/A',
                  osName: record.deviceInfo?.osName || 'N/A',
                  osVersion: record.deviceInfo?.osVersion || 'N/A',
                  userDetails: record.userDetails?.name || '알 수 없음',
                  rentTime: 'N/A',
                  returnTime: new Date(record.timestamp).toLocaleString(),
                  remark: ''
                });
              }
            }
          });

          rentRecords.forEach(rent => {
            if (!rent.matched) {
              pairs.push({
                serialNumber: rent.serialNumber,
                modelName: rent.deviceInfo?.modelName || 'N/A',
                osName: rent.deviceInfo?.osName || 'N/A',
                osVersion: rent.deviceInfo?.osVersion || 'N/A',
                userDetails: rent.userDetails?.name || '알 수 없음',
                rentTime: new Date(rent.timestamp).toLocaleString(),
                returnTime: 'N/A',
                remark: rent.remark || ''
              });
            }
          });

          const sortedPairs = pairs.sort((a, b) => {
            const aTime = a.returnTime !== 'N/A' ? new Date(a.returnTime) : new Date(a.rentTime);
            const bTime = b.returnTime !== 'N/A' ? new Date(b.returnTime) : new Date(b.rentTime);
            return bTime - aTime;
          });

          console.log('Processed history pairs:', sortedPairs);
          setHistoryPairs(sortedPairs);
          setOriginalPairs(sortedPairs);
        } else if (isMounted) {
          console.log('No valid data received, resetting pairs');
          setHistoryPairs([]);
          setOriginalPairs([]);
        }
      } catch (err) {
        if (isMounted) {
          setError('데이터를 불러오지 못했습니다. 서버를 확인해 주세요.');
          console.error('Error fetching history:', err);
          console.error('Error details:', err.response?.data || err.message);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleSearch = () => {
    console.log('Handling search with serial:', searchSerial);
    if (!searchSerial.trim()) {
      console.log('Search serial empty, resetting to all pairs');
      setHistoryPairs(originalPairs);
      return;
    }
    const filtered = originalPairs.filter(pair => 
      pair.serialNumber.toLowerCase().includes(searchSerial.toLowerCase())
    );
    console.log('Filtered pairs:', filtered);
    setHistoryPairs(filtered);
  };

  const handleReset = () => {
    console.log('Resetting search');
    setSearchSerial('');
    setHistoryPairs(originalPairs);
  };

  const handleExport = async () => {
    let payload = { period: selectedPeriod };
    if (selectedPeriod === 'custom' && customDateRange.start && customDateRange.end) {
      payload = { ...payload, startDate: customDateRange.start, endDate: customDateRange.end };
    }
    try {
      console.log('Exporting history with payload:', payload);
      const response = await axios.post(`${apiUrl}/api/devices/history/export`, payload, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'arraybuffer'
      });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `history_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      console.error('Export error:', error);
      alert('엑셀 내보내기에 실패했습니다.');
    }
  };

  const openRemarkModal = (remark) => {
    console.log('Opening remark modal with remark:', remark);
    setSelectedRemark(remark);
    setShowRemarkModal(true);
  };

  const closeRemarkModal = () => {
    console.log('Closing remark modal');
    setShowRemarkModal(false);
    setSelectedRemark('');
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
        <div style={{ marginTop: '10px' }}>
          <label>기간 선택: </label>
          <select
            value={selectedPeriod}
            onChange={(e) => {
              setSelectedPeriod(e.target.value);
              if (e.target.value !== 'custom') {
                setCustomDateRange({ start: '', end: '' });
              }
            }}
            style={{ padding: '5px', marginRight: '10px' }}
          >
            <option value="all">전체</option>
            <option value="week">지난 1주일</option>
            <option value="month">지난 1개월</option>
            <option value="custom">사용자 지정</option>
          </select>
          {selectedPeriod === 'custom' && (
            <div style={{ display: 'inline-block', marginLeft: '10px' }}>
              <input
                type="date"
                value={customDateRange.start}
                onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                style={{ padding: '5px' }}
              />
              <span style={{ margin: '0 5px' }}>~</span>
              <input
                type="date"
                value={customDateRange.end}
                onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                style={{ padding: '5px' }}
              />
            </div>
          )}
          <button onClick={handleExport} style={{ marginLeft: '10px' }}>엑셀 다운로드</button>
        </div>
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
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>특이사항</th>
            </tr>
          </thead>
          <tbody>
            {historyPairs.map((pair, index) => (
              <tr key={index}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{pair.serialNumber}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{pair.modelName}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{pair.osName}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{pair.osVersion}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{pair.userDetails}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{pair.rentTime}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{pair.returnTime}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {pair.remark ? (
                    <button
                      onClick={() => openRemarkModal(pair.remark)}
                      style={{ padding: '5px 10px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                    >
                      보기
                    </button>
                  ) : (
                    '없음'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {showRemarkModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{
            backgroundColor: 'white', padding: '20px', borderRadius: '5px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)', width: '400px', textAlign: 'center'
          }}>
            <h3>특이사항</h3>
            <p style={{ margin: '20px 0', whiteSpace: 'pre-wrap' }}>{selectedRemark}</p>
            <button
              onClick={closeRemarkModal}
              style={{ padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DeviceHistory;