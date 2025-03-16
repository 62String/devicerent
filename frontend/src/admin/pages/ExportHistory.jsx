import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ReactPaginate from 'react-paginate';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ko } from 'date-fns/locale';

function ExportHistory() {
  const [exports, setExports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [perPage] = useState(10);
  const [startDate, setStartDate] = useState(new Date('2020-01-01')); // 기본값으로 초기화
  const [endDate, setEndDate] = useState(null);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  const token = localStorage.getItem('token');

  const fetchExportHistory = async () => {
    setLoading(true);
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
      setExports(response.data);
    } catch (error) {
      console.error('Error fetching export history:', error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExportHistory();
  }, [startDate, endDate]);

  const handlePageClick = (data) => {
    setPage(data.selected);
  };

  const handleResetFilter = () => {
    setStartDate(new Date('2020-01-01')); // 초기값으로 복원
    setEndDate(null);
    fetchExportHistory();
  };

  const offset = page * perPage;
  const currentExports = exports.slice(offset, offset + perPage);
  const pageCount = Math.ceil(exports.length / perPage);

  return (
    <div>
      <h1>익스포트 내역</h1>
      <div style={{ marginBottom: '20px' }}>
        <DatePicker
          selected={startDate}
          onChange={date => setStartDate(date)}
          selectsStart
          startDate={startDate}
          endDate={endDate}
          minDate={new Date('2020-01-01')} // 기본 최소 날짜
          placeholderText="시작 날짜 선택"
          showMonthDropdown
          showYearDropdown
          dropdownMode="select"
          locale={ko}
          weekStartsOn={0}
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
        />
        <button onClick={fetchExportHistory} style={{ marginLeft: '10px' }}>필터 적용</button>
        <button onClick={handleResetFilter} style={{ marginLeft: '10px' }}>초기화</button>
      </div>
      {loading ? (
        <p>로딩 중...</p>
      ) : exports.length === 0 ? (
        <p>익스포트 내역이 없습니다.</p>
      ) : (
        <>
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
              {currentExports.map(exp => (
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
          <ReactPaginate
            previousLabel={'이전'}
            nextLabel={'다음'}
            breakLabel={'...'}
            pageCount={pageCount}
            marginPagesDisplayed={2}
            pageRangeDisplayed={5}
            onPageChange={handlePageClick}
            containerClassName={'pagination'}
            activeClassName={'active'}
            style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}
          />
        </>
      )}
    </div>
  );
}

export default ExportHistory;