import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ko } from 'date-fns/locale';

function ExportHistory() {
  const [exports, setExports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [startDate, setStartDate] = useState(new Date('2020-01-01'));
  const [endDate, setEndDate] = useState(null);
  const perPage = 50; // 50개로 설정
  const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4000`;
  const token = localStorage.getItem('token');

  const fetchExportHistory = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      let url = `${apiUrl}/api/devices/history/exports`;
      if (startDate && endDate) {
        const adjustedEndDate = new Date(endDate);
        adjustedEndDate.setDate(adjustedEndDate.getDate() + 1); // 종료 날짜 하루 추가
        url += `?startDate=${startDate.toISOString()}&endDate=${adjustedEndDate.toISOString()}`;
      }
      console.log('Fetching export history with URL:', url);
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Received data:', response.data.length, response.data);
      // exportType 추가: filePath에서 패턴 매칭으로 분류
      const updatedExports = response.data.map(exp => {
        let exportType = 'device';
        if (exp.filePath.includes('retention')) {
          exportType = 'retention';
        } else if (exp.filePath.includes('backup')) {
          exportType = 'backup';
        }
        return { ...exp, exportType };
      });
      setExports(updatedExports);
      setMessage('익스포트 내역을 성공적으로 불러왔습니다.');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || '익스포트 내역을 불러오는데 실패했습니다.');
      console.error('Error fetching export history:', error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExportHistory();
  }, [startDate, endDate]);

  const handleResetFilter = () => {
    setStartDate(new Date('2020-01-01')); // 초기값으로 복원
    setEndDate(null);
    fetchExportHistory();
  };

  const filteredExports = exports.filter(exp =>
    exp.filePath.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exp.performedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exp.exportType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedExports = [...filteredExports].sort((a, b) => {
    if (!sortField) return 0;
    let aValue, bValue;
    if (sortField === 'timestamp') {
      aValue = new Date(a[sortField]).getTime();
      bValue = new Date(b[sortField]).getTime();
    } else {
      aValue = a[sortField] || 0;
      bValue = b[sortField] || 0;
    }
    if (aValue == null) return sortOrder === 'asc' ? 1 : -1;
    if (bValue == null) return sortOrder === 'asc' ? -1 : 1;
    return sortOrder === 'asc' ? (aValue > bValue ? 1 : -1) : (bValue > aValue ? 1 : -1);
  });

  const indexOfLastExport = currentPage * perPage;
  const indexOfFirstExport = indexOfLastExport - perPage;
  const currentExports = sortedExports.slice(indexOfFirstExport, indexOfLastExport);
  const totalPages = Math.ceil(filteredExports.length / perPage);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-900 text-white p-4">
        <h1 className="text-3xl font-bold text-center">Device Rental System</h1>
      </header>
      <div className="container mx-auto p-4 max-w-4xl">
        <h2 className="text-2xl font-semibold text-gray-700 mb-4 text-center">익스포트 내역</h2>
        {error && <div className="text-red-500 text-center mb-4 bg-red-100 p-2 rounded">❌ {error}</div>}
        {message && (
          <div className={`text-center mb-4 p-2 rounded ${message.includes('실패') || message.includes('불가') || message.includes('입력해주세요') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message.includes('실패') || message.includes('불가') || message.includes('입력해주세요') ? '❌' : '✅'} {message}
          </div>
        )}
        <div className="mb-6 flex flex-wrap gap-2 justify-center">
          <DatePicker
            selected={startDate}
            onChange={date => setStartDate(date)}
            selectsStart
            startDate={startDate}
            endDate={endDate}
            minDate={new Date('2020-01-01')}
            placeholderText="시작 날짜 선택"
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
            locale={ko}
            weekStartsOn={0}
            className="p-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <DatePicker
            selected={endDate}
            onChange={date => setEndDate(date)}
            selectsEnd
            startDate={startDate}
            endDate={endDate}
            minDate={startDate || new Date('2020-01-01')}
            placeholderText="종료 날짜 선택"
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
            locale={ko}
            weekStartsOn={0}
            className="p-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={fetchExportHistory}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            필터 적용
          </button>
          <button
            onClick={handleResetFilter}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            초기화
          </button>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="검색..."
            className="p-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {loading ? (
          <p className="text-gray-600 text-center">로딩 중...</p>
        ) : exports.length === 0 ? (
          <p className="text-gray-600 text-center">익스포트 내역이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto mx-auto max-w-[1024px]">
            <table className="min-w-full border-collapse bg-white shadow-md rounded-lg">
              <thead>
                <tr className="bg-blue-50">
                  {['timestamp', 'exportType', 'filePath', 'recordCount', 'deletedCount', 'performedBy', '다운로드'].map((header) => (
                    <th
                      key={header}
                      className="border border-gray-200 p-1 text-left font-medium text-gray-700 cursor-pointer min-w-[100px] max-w-[150px] whitespace-normal"
                      onClick={() => {
                        if (header !== '다운로드') {
                          if (sortField === header) {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField(header);
                            setSortOrder('asc');
                          }
                        }
                      }}
                    >
                      {header === 'timestamp' ? '익스포트 시간' :
                        header === 'exportType' ? '유형' :
                        header === 'filePath' ? '파일 경로' :
                        header === 'recordCount' ? '레코드 수' :
                        header === 'deletedCount' ? '삭제된 레코드 수' :
                        header === 'performedBy' ? '수행자' : '다운로드'} 
                      {sortField === header && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentExports.map(exp => (
                  <tr key={exp._id} className="hover:bg-gray-50">
                    <td className="border border-gray-200 p-2 whitespace-normal">{new Date(exp.timestamp).toLocaleString()}</td>
                    <td className="border border-gray-200 p-2 whitespace-normal">{exp.exportType}</td>
                    <td className="border border-gray-200 p-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]" title={exp.filePath}>
                      {exp.filePath}
                    </td>
                    <td className="border border-gray-200 p-2 whitespace-normal">{exp.recordCount}</td>
                    <td className="border border-gray-200 p-2 whitespace-normal">{exp.deletedCount}</td>
                    <td className="border border-gray-200 p-2 whitespace-normal">{exp.performedBy}</td>
                    <td className="border border-gray-200 p-2">
                      <a href={`${apiUrl}${exp.filePath}`} download className="text-blue-600 hover:underline">
                        다운로드
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className={`px-3 py-1 rounded ${currentPage === 1 ? 'bg-gray-300 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}
                disabled={currentPage === 1}
              >
                이전
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`px-3 py-1 rounded ${currentPage === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className={`px-3 py-1 rounded ${currentPage === totalPages ? 'bg-gray-300 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}
                disabled={currentPage === totalPages}
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExportHistory;