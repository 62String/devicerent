import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ko } from 'date-fns/locale';
import { SearchIcon, DownloadIcon } from '../../components/Icons';

const TYPE_BADGE = {
  retention: { label: '보존정책', className: 'badge badge-warn' },
  backup: { label: '백업', className: 'badge badge-neutral' },
  device: { label: '디바이스', className: 'badge badge-ok' },
};

function ExportHistory() {
  const [exports, setExports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [startDate, setStartDate] = useState(new Date('2020-01-01'));
  const [endDate, setEndDate] = useState(null);
  const perPage = 50;
  const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4000`;
  const token = localStorage.getItem('token');

  const fetchExportHistory = async () => {
    setLoading(true);
    setError('');
    try {
      let url = `${apiUrl}/api/devices/history/exports`;
      if (startDate && endDate) {
        const adjustedEndDate = new Date(endDate);
        adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);
        url += `?startDate=${startDate.toISOString()}&endDate=${adjustedEndDate.toISOString()}`;
      }
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
    } catch (error) {
      setError(error.response?.data?.message || '익스포트 내역을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExportHistory();
  }, [startDate, endDate]);

  const handleResetFilter = () => {
    setStartDate(new Date('2020-01-01'));
    setEndDate(null);
    setSearchTerm('');
    setCurrentPage(1);
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
  const totalPages = Math.max(1, Math.ceil(filteredExports.length / perPage));

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortIndicator = (field) =>
    sortField === field ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : '';

  const fileName = (filePath) => filePath.split('/').pop();

  return (
    <div className="min-h-screen bg-paper">
      <div className="page-wrap">
        <h1 className="page-title">익스포트 내역</h1>
        <p className="page-sub">엑셀 익스포트와 백업 기록을 조회합니다</p>

        {error && <div className="alert alert-error mt-5">{error}</div>}

        <div className="flex gap-2 mt-5 mb-4 flex-wrap items-center">
          <DatePicker
            selected={startDate}
            onChange={date => setStartDate(date)}
            selectsStart
            startDate={startDate}
            endDate={endDate}
            minDate={new Date('2020-01-01')}
            placeholderText="시작 날짜"
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
            locale={ko}
            weekStartsOn={0}
            className="input w-[130px]"
          />
          <span className="text-hint">~</span>
          <DatePicker
            selected={endDate}
            onChange={date => setEndDate(date)}
            selectsEnd
            startDate={startDate}
            endDate={endDate}
            minDate={startDate || new Date('2020-01-01')}
            placeholderText="종료 날짜"
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
            locale={ko}
            weekStartsOn={0}
            className="input w-[130px]"
          />
          <button onClick={handleResetFilter} className="btn btn-outline">초기화</button>
          <div className="relative flex-1 min-w-[180px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-hint pointer-events-none">
              <SearchIcon size={14} />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="파일명, 수행자, 유형 검색"
              className="input w-full pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="card p-10 text-center text-sub text-sm">로딩 중...</div>
        ) : exports.length === 0 ? (
          <div className="card p-10 text-center text-sub text-sm">익스포트 내역이 없습니다.</div>
        ) : (
          <>
            <div className="card overflow-x-auto">
              <table className="table-note" style={{ tableLayout: 'fixed', minWidth: 760 }}>
                <thead>
                  <tr>
                    <th style={{ width: 150 }} className="cursor-pointer select-none" onClick={() => handleSort('timestamp')}>
                      익스포트 시간{sortIndicator('timestamp')}
                    </th>
                    <th style={{ width: 86 }} className="cursor-pointer select-none" onClick={() => handleSort('exportType')}>
                      유형{sortIndicator('exportType')}
                    </th>
                    <th>파일</th>
                    <th style={{ width: 84 }} className="cursor-pointer select-none" onClick={() => handleSort('recordCount')}>
                      레코드{sortIndicator('recordCount')}
                    </th>
                    <th style={{ width: 84 }} className="cursor-pointer select-none" onClick={() => handleSort('deletedCount')}>
                      삭제{sortIndicator('deletedCount')}
                    </th>
                    <th style={{ width: 90 }} className="cursor-pointer select-none" onClick={() => handleSort('performedBy')}>
                      수행자{sortIndicator('performedBy')}
                    </th>
                    <th style={{ width: 96 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {currentExports.map(exp => {
                    const badge = TYPE_BADGE[exp.exportType] || TYPE_BADGE.device;
                    return (
                      <tr key={exp._id}>
                        <td className="td-sub text-xs">{new Date(exp.timestamp).toLocaleString()}</td>
                        <td><span className={badge.className}>{badge.label}</span></td>
                        <td>
                          <div className="td-mono truncate" style={{ color: 'var(--sub)' }} title={exp.filePath}>
                            {fileName(exp.filePath)}
                          </div>
                        </td>
                        <td className="td-sub">{exp.recordCount}</td>
                        <td className="td-sub">{exp.deletedCount}</td>
                        <td className="td-sub">{exp.performedBy}</td>
                        <td className="text-right">
                          <a href={`${apiUrl}${exp.filePath}`} download className="btn btn-outline btn-sm">
                            <DownloadIcon size={12} />
                            받기
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-1.5 mt-4">
                <button
                  className="pg-btn"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i + 1}
                    className={`pg-btn ${currentPage === i + 1 ? 'pg-btn-active' : ''}`}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  className="pg-btn"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  ›
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ExportHistory;
