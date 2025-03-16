import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ReactPaginate from 'react-paginate';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ko } from 'date-fns/locale';
import { saveAs } from 'file-saver';

function DeviceHistory() {
  const [historyPairs, setHistoryPairs] = useState([]);
  const [originalPairs, setOriginalPairs] = useState([]);
  const [searchSerial, setSearchSerial] = useState('');
  const [error, setError] = useState(null);
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [selectedRemark, setSelectedRemark] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [page, setPage] = useState(0);
  const [perPage] = useState(10);
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        console.log('Fetching history from:', `${apiUrl}/api/devices/history`);
        let url = `${apiUrl}/api/devices/history`;
        if (selectedPeriod === 'custom' && customDateRange.start && customDateRange.end) {
          url += `?startDate=${customDateRange.start}&endDate=${customDateRange.end}`;
        } else if (selectedPeriod === 'week') {
          const now = new Date();
          const start = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
          url += `?startDate=${start}&endDate=${new Date().toISOString().split('T')[0]}`;
        } else if (selectedPeriod === 'month') {
          const now = new Date();
          const start = new Date(now.setMonth(now.getMonth() - 1)).toISOString().split('T')[0];
          url += `?startDate=${start}&endDate=${new Date().toISOString().split('T')[0]}`;
        }
        console.log('Fetching history with URL:', url);
        const historyResponse = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Fetched history data (raw):', historyResponse.data);
        let sortedHistory = [];
        if (isMounted && historyResponse.data && Array.isArray(historyResponse.data)) {
          sortedHistory = historyResponse.data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        } else {
          console.log('No valid API data, using dummy data');
          for (let i = 0; i < 15; i++) {
            sortedHistory.push({
              action: i % 2 === 0 ? 'rent' : 'return',
              serialNumber: `GD_A_00${i}`,
              timestamp: new Date(Date.now() - i * 3600000).toISOString(),
              deviceInfo: { modelName: '갤럭시', osName: 'AOS', osVersion: '14' },
              userDetails: { name: '테스트 사용자' },
            });
          }
        }
        const pairs = [];
        const rentRecords = [];

        sortedHistory.forEach(record => {
          console.log('Processing record:', record);
          if (record.action === 'rent') {
            rentRecords.push(record);
          } else if (record.action === 'return') {
            const matchingRent = rentRecords.find(rent => 
              rent.serialNumber === record.serialNumber && !rent.matched
            );
            console.log('Matching rent for return:', matchingRent);
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

        console.log('Processed pairs before sorting:', pairs);
        console.log('Processed history pairs length:', sortedPairs.length);
        setHistoryPairs(sortedPairs);
        setOriginalPairs(sortedPairs);
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
  }, [token, selectedPeriod, customDateRange]);

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
    setSelectedPeriod('all');
    setCustomDateRange({ start: '', end: '' });
    setHistoryPairs(originalPairs);
  };

  const handleExport = async () => {
    let payload = {};
    if (selectedPeriod === 'custom' && customDateRange.start && customDateRange.end) {
      payload = { startDate: customDateRange.start, endDate: customDateRange.end };
    } else if (selectedPeriod === 'week') {
      const now = new Date();
      const start = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
      const end = new Date().toISOString().split('T')[0];
      payload = { startDate: start, endDate: end };
    } else if (selectedPeriod === 'month') {
      const now = new Date();
      const start = new Date(now.setMonth(now.getMonth() - 1)).toISOString().split('T')[0];
      const end = new Date().toISOString().split('T')[0];
      payload = { startDate: start, endDate: end };
    } else if (selectedPeriod === 'all') {
      payload = { period: 'all' };
    }
    try {
      console.log('Exporting history with payload:', payload);
      const response = await axios.post(`${apiUrl}/api/devices/history/export`, payload, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'arraybuffer'
      });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const fileName = selectedPeriod === 'custom' 
        ? `history_export_${customDateRange.start}_to_${customDateRange.end}.xlsx`
        : `history_export_${selectedPeriod}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      saveAs(blob, fileName);
    } catch (error) {
      console.error('Export error:', error);
      alert('엑셀 내보내기에 실패했습니다.');
    }
  };

  const handlePageClick = (data) => {
    setPage(data.selected);
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

  const offset = page * perPage;
  const currentPairs = historyPairs.slice(offset, offset + perPage);
  const pageCount = Math.ceil(historyPairs.length / perPage);

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">대여 히스토리</h2>
      <div className="mb-6 flex flex-wrap items-center gap-2 bg-gray-50 p-3 rounded-md">
        <input
          type="text"
          value={searchSerial}
          onChange={(e) => setSearchSerial(e.target.value)}
          placeholder="시리얼 번호 검색"
          className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={handleSearch} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          검색
        </button>
        <button onClick={handleReset} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
          초기화
        </button>
        <div className="flex items-center gap-2">
          <label className="text-gray-700">기간 선택:</label>
          <select
            value={selectedPeriod}
            onChange={(e) => {
              setSelectedPeriod(e.target.value);
              if (e.target.value !== 'custom') {
                setCustomDateRange({ start: '', end: '' });
              }
            }}
            className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">전체</option>
            <option value="week">지난 1주일</option>
            <option value="month">지난 1개월</option>
            <option value="custom">사용자 지정</option>
          </select>
          {selectedPeriod === 'custom' && (
            <div className="flex items-center gap-2">
              <DatePicker
                selected={customDateRange.start ? new Date(customDateRange.start) : null}
                onChange={date => setCustomDateRange({ ...customDateRange, start: date.toISOString().split('T')[0] })}
                selectsStart
                startDate={customDateRange.start ? new Date(customDateRange.start) : null}
                endDate={customDateRange.end ? new Date(customDateRange.end) : null}
                minDate={new Date('2020-01-01')}
                placeholderText="시작 날짜"
                locale={ko}
                weekStartsOn={0}
                className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-500">~</span>
              <DatePicker
                selected={customDateRange.end ? new Date(customDateRange.end) : null}
                onChange={date => setCustomDateRange({ ...customDateRange, end: date.toISOString().split('T')[0] })}
                selectsEnd
                startDate={customDateRange.start ? new Date(customDateRange.start) : null}
                endDate={customDateRange.end ? new Date(customDateRange.end) : null}
                minDate={customDateRange.start ? new Date(customDateRange.start) : new Date('2020-01-01')}
                placeholderText="종료 날짜"
                locale={ko}
                weekStartsOn={0}
                className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          <button onClick={handleExport} className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600">
            엑셀 다운로드
          </button>
        </div>
      </div>
      {error && <p className="text-red-500">{error}</p>}
      {!error && historyPairs.length === 0 && <p>대여 히스토리가 없습니다.</p>}
      {!error && historyPairs.length > 0 && (
        <>
          <table className="w-full border-collapse bg-white shadow-md rounded-lg">
            <thead>
              <tr className="bg-blue-50">
                <th className="border border-gray-200 p-2 text-left font-medium text-gray-700">시리얼 번호</th>
                <th className="border border-gray-200 p-2 text-left font-medium text-gray-700">기기명</th>
                <th className="border border-gray-200 p-2 text-left font-medium text-gray-700">OS 이름</th>
                <th className="border border-gray-200 p-2 text-left font-medium text-gray-700">OS 버전</th>
                <th className="border border-gray-200 p-2 text-left font-medium text-gray-700">대여자</th>
                <th className="border border-gray-200 p-2 text-left font-medium text-gray-700">대여 시간</th>
                <th className="border border-gray-200 p-2 text-left font-medium text-gray-700">반납 시간</th>
                <th className="border border-gray-200 p-2 text-left font-medium text-gray-700">특이사항</th>
              </tr>
            </thead>
            <tbody>
              {currentPairs.map((pair, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="border border-gray-200 p-2">{pair.serialNumber}</td>
                  <td className="border border-gray-200 p-2">{pair.modelName}</td>
                  <td className="border border-gray-200 p-2">{pair.osName}</td>
                  <td className="border border-gray-200 p-2">{pair.osVersion}</td>
                  <td className="border border-gray-200 p-2">{pair.userDetails}</td>
                  <td className="border border-gray-200 p-2">{pair.rentTime}</td>
                  <td className="border border-gray-200 p-2">{pair.returnTime}</td>
                  <td className="border border-gray-200 p-2">
                    {pair.remark ? (
                      <button
                        onClick={() => openRemarkModal(pair.remark)}
                        className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
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
          <ReactPaginate
            previousLabel={'이전'}
            nextLabel={'다음'}
            breakLabel={'...'}
            pageCount={pageCount}
            marginPagesDisplayed={2}
            pageRangeDisplayed={5}
            onPageChange={handlePageClick}
            containerClassName={'flex flex-row justify-center items-center space-x-2 mt-4 list-none'}
            activeClassName={'bg-blue-600 text-white rounded-md'}
            pageClassName={'px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-100'}
            previousClassName={'px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50'}
            nextClassName={'px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50'}
            breakClassName={'px-3 py-1'}
            disabledClassName={'opacity-50 cursor-not-allowed'}
          />
        </>
      )}
      {showRemarkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg shadow-lg w-96 text-center">
            <h3 className="text-lg font-semibold mb-2 text-gray-800">특이사항</h3>
            <p className="mb-4 whitespace-pre-wrap text-gray-600">{selectedRemark}</p>
            <button
              onClick={closeRemarkModal}
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
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