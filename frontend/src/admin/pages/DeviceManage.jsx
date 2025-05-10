import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';

const DeviceManage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [newDevice, setNewDevice] = useState({ serialNumber: '', deviceInfo: '', osName: '', osVersion: '', modelName: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInitModal, setShowInitModal] = useState(false);
  const [showExportConfirmModal, setShowExportConfirmModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadFileName, setDownloadFileName] = useState('');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [newStatus, setNewStatus] = useState('active');
  const [statusReason, setStatusReason] = useState('');
  const [forceInit, setForceInit] = useState(false);
  const [latestExportPath, setLatestExportPath] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showStatusHistory, setShowStatusHistory] = useState(false);
  const [statusHistory, setStatusHistory] = useState([]);
  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
  const [selectedFile, setSelectedFile] = useState(null); // 새 상태: 업로드할 파일
  const devicesPerPage = 50;
  const historyPerPage = 50;
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/devices`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      console.log('DeviceManage fetchDevices response:', response.data);
      setDevices(response.data);
      setError(null);
    } catch (err) {
      setError('디바이스 목록을 불러오지 못했습니다. 서버를 확인해 주세요.');
      console.error('Error fetching devices:', err);
    }
  };

  const fetchStatusHistory = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/devices/status-history`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      console.log('All device status history response:', response.data);
      setStatusHistory(response.data);
      setShowStatusHistory(true);
    } catch (err) {
      console.error('Error fetching all device status history:', err);
      setMessage('상태 변경 이력 조회 실패');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const hideStatusHistory = () => {
    setShowStatusHistory(false);
    setStatusHistory([]);
    setHistoryCurrentPage(1);
  };

  const filteredDevices = devices.filter(device =>
    device.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.modelName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.osName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredStatusHistory = statusHistory.filter(history =>
    history.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (history.modelName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (history.osName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedDevices = [...filteredDevices].sort((a, b) => {
    if (!sortField) return 0;
    const aValue = a[sortField];
    const bValue = b[sortField];
    if (aValue == null) return sortOrder === 'asc' ? 1 : -1;
    if (bValue == null) return sortOrder === 'asc' ? -1 : 1;
    return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
  });

  const indexOfLastDevice = currentPage * devicesPerPage;
  const indexOfFirstDevice = indexOfLastDevice - devicesPerPage;
  const currentDevices = sortedDevices.slice(indexOfFirstDevice, indexOfLastDevice);
  const totalPages = Math.ceil(filteredDevices.length / devicesPerPage);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!newDevice.serialNumber || !newDevice.deviceInfo || !newDevice.osName) {
      setMessage('시리얼 번호, 디바이스 정보, OS 이름은 필수 입력 항목입니다.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    try {
      const response = await axios.post(`${apiUrl}/api/devices/manage/register`, newDevice, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      setMessage(response.data.message);
      setTimeout(() => setMessage(''), 3000);
      setNewDevice({ serialNumber: '', deviceInfo: '', osName: '', osVersion: '', modelName: '' });
      fetchDevices();
    } catch (err) {
      setMessage(err.response?.data?.message || '등록 실패');
      setTimeout(() => setMessage(''), 3000);
      console.error('Error registering device:', err);
    }
  };

  const openDeleteModal = (serialNumber) => {
    setSelectedDevice({ serialNumber });
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setSelectedDevice(null);
  };

  const handleDelete = async () => {
    try {
      const response = await axios.post(`${apiUrl}/api/devices/manage/delete`, { serialNumber: selectedDevice.serialNumber }, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      setMessage(response.data.message);
      setTimeout(() => setMessage(''), 3000);
      fetchDevices();
    } catch (err) {
      setMessage('삭제 실패');
      setTimeout(() => setMessage(''), 3000);
      console.error('Error deleting device:', err);
    } finally {
      closeDeleteModal();
    }
  };

  const openStatusModal = (device) => {
    setSelectedDevice(device);
    setNewStatus(device.status);
    setStatusReason(device.statusReason || '');
    setShowStatusModal(true);
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setSelectedDevice(null);
    setNewStatus('active');
    setStatusReason('');
  };

  const handleUpdateStatus = async () => {
    try {
      const response = await axios.post(`${apiUrl}/api/devices/manage/update-status`, {
        serialNumber: selectedDevice.serialNumber,
        status: newStatus,
        statusReason: statusReason || ''
      }, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      setMessage(response.data.message);
      setTimeout(() => setMessage(''), 3000);
      fetchDevices();
    } catch (err) {
      setMessage('상태 업데이트 실패');
      setTimeout(() => setMessage(''), 3000);
      console.error('Error updating device status:', err);
    } finally {
      closeStatusModal();
    }
  };

  const handleInitDevices = async () => {
    try {
      const response = await axios.post(
        `${apiUrl}/api/admin/init-devices`,
        { force: forceInit, exportPath: latestExportPath },
        {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          withCredentials: true,
        }
      );
      setMessage('디바이스 초기화 성공');
      setTimeout(() => setMessage(''), 3000);
      fetchDevices();
    } catch (error) {
      setMessage(error.response?.data?.message || '디바이스 초기화 실패');
      setTimeout(() => setMessage(''), 3000);
      console.error('Device initialization error:', error);
    }
  };

  const openInitModal = (force) => {
    setForceInit(force);
    setShowInitModal(true);
  };

  const closeInitModal = () => {
    setShowInitModal(false);
    setForceInit(false);
  };

  const confirmInit = () => {
    setShowInitModal(false);
    setShowExportConfirmModal(true);
  };

  const closeExportConfirmModal = () => {
    setShowExportConfirmModal(false);
    setForceInit(false);
  };

  const confirmExportAndInit = () => {
    handleInitDevices();
    setShowExportConfirmModal(false);
  };

  const closeDownloadModal = () => {
    setShowDownloadModal(false);
    setDownloadUrl('');
    setDownloadFileName('');
  };

  const exportToExcel = async () => {
    try {
      const exportData = devices.map(device => ({
        '시리얼 번호': device.serialNumber,
        '디바이스 정보': device.deviceInfo || device.modelName || 'N/A',
        '모델명': device.modelName || 'N/A',
        'OS 이름': device.osName || 'N/A',
        'OS 버전': device.osVersion || 'N/A',
        '대여자': device.rentedBy ? `${device.rentedBy.name} (${device.rentedBy.affiliation || 'N/A'})` : '없음',
        '대여일시': device.rentedAt ? new Date(device.rentedAt).toLocaleString() : '없음'
      }));

      const response = await axios.post(`${apiUrl}/api/devices/export`, exportData, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
        withCredentials: true
      });

      const dateTime = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `device_list_${dateTime}.xlsx`;
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const url = window.URL.createObjectURL(blob);
      setDownloadUrl(url);
      setDownloadFileName(fileName);
      setShowDownloadModal(true);
      setLatestExportPath(fileName);
      setMessage('엑셀 파일이 준비되었습니다. 다운로드 버튼을 눌러 저장해 주세요.');
      setTimeout(() => setMessage(''), 3000);

      if (response.status === 200) {
        console.log('Export successful, file download triggered');
      } else {
        console.warn('Server returned non-200 status:', response.status);
      }
    } catch (error) {
      if (error.response && error.response.status === 200) {
        setMessage('엑셀 파일이 준비되었습니다. 다운로드 버튼을 눌러 저장해 주세요.');
        console.log('File prepared despite server error:', error);
      } else {
        setMessage('엑셀 익스포트 실패');
        setTimeout(() => setMessage(''), 3000);
        console.error('Export error:', error);
      }
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = downloadFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      window.URL.revokeObjectURL(downloadUrl);
      closeDownloadModal();
      setMessage('파일이 다운로드되었습니다.');
      setTimeout(() => setMessage(''), 3000);
    }, 100);
  };

  // 새 기능: 파일 업로드 핸들러
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    if (file) {
      setMessage(`선택된 파일: ${file.name}`);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage('업로드할 파일을 선택해 주세요.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const formData = new FormData();
    formData.append('excelFile', selectedFile);

    try {
      const response = await axios.post(`${apiUrl}/api/admin/upload-devices`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        },
        withCredentials: true
      });
      setMessage('디바이스 초기화 성공!');
      setTimeout(() => setMessage(''), 3000);
      setSelectedFile(null); // 파일 선택 초기화
      fetchDevices(); // 디바이스 목록 갱신
    } catch (err) {
      setMessage(err.response?.data?.message || '파일 업로드 및 초기화 실패');
      setTimeout(() => setMessage(''), 3000);
      console.error('Error uploading file:', err);
    }
  };

  if (!user || !user.isAdmin) {
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center">관리자 권한이 없습니다.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-900 text-white p-4">
        <h1 className="text-3xl font-bold text-center">Device Rental System</h1>
      </header>
      <div className="container mx-auto p-4 max-w-4xl">
        {user && (
          <div className="mb-6 flex flex-wrap gap-2 justify-center">
            {user.isAdmin && (
              <>
                <button onClick={() => navigate('/admin')} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 mr-2">관리자 페이지</button>
                <button onClick={() => navigate('/devices/manage')} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 mr-2">디바이스 관리</button>
              </>
            )}
          </div>
        )}
        <h2 className="text-2xl font-semibold text-gray-700 mb-4 text-center">디바이스 관리</h2>
        {message && (
          <div className={`text-center mb-4 p-2 rounded ${message.includes('실패') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message.includes('성공') && '✅'} {message.includes('실패') && '❌'} {message}
          </div>
        )}
        {error && <p className="text-red-500 text-center mb-4 bg-red-100 p-2 rounded">❌ {error}</p>}
        <div className="mb-6 flex flex-wrap gap-2 justify-center">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
              setHistoryCurrentPage(1);
            }}
            placeholder="검색..."
            className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => openInitModal(false)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            엑셀 초기화 (업데이트)
          </button>
          <button
            onClick={() => openInitModal(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            엑셀 강제 초기화
          </button>
          <button
            onClick={exportToExcel}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            엑셀 익스포트
          </button>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleUpload}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              엑셀 파일 임포트
            </button>
          </div>
          <button
            onClick={showStatusHistory ? hideStatusHistory : fetchStatusHistory}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
          >
            {showStatusHistory ? '기기 목록 보기' : '상태 변경 이력'}
          </button>
        </div>
        <form onSubmit={handleRegister} className="mb-6 flex flex-wrap gap-2 justify-center bg-gray-50 p-3 rounded-md">
          <input
            type="text"
            value={newDevice.serialNumber}
            onChange={(e) => setNewDevice({ ...newDevice, serialNumber: e.target.value })}
            placeholder="시리얼 번호"
            required
            className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            value={newDevice.deviceInfo}
            onChange={(e) => setNewDevice({ ...newDevice, deviceInfo: e.target.value })}
            placeholder="디바이스 정보"
            required
            className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            value={newDevice.osName}
            onChange={(e) => setNewDevice({ ...newDevice, osName: e.target.value })}
            placeholder="OS 이름"
            required
            className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            value={newDevice.osVersion}
            onChange={(e) => setNewDevice({ ...newDevice, osVersion: e.target.value })}
            placeholder="OS 버전"
            className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            value={newDevice.modelName}
            onChange={(e) => setNewDevice({ ...newDevice, modelName: e.target.value })}
            placeholder="모델명"
            className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            등록
          </button>
        </form>
        {!error && (
          showStatusHistory ? (
            <div className="overflow-x-auto mx-auto max-w-[1024px]">
              <table className="min-w-full border-collapse bg-white shadow-md rounded-lg">
                <thead>
                  <tr className="bg-blue-50">
                    <th className="border border-gray-200 p-2 text-left font-medium text-gray-700">시리얼 번호</th>
                    <th className="border border-gray-200 p-2 text-left font-medium text-gray-700">모델명</th>
                    <th className="border border-gray-200 p-2 text-left font-medium text-gray-700">OS 이름</th>
                    <th className="border border-gray-200 p-2 text-left font-medium text-gray-700">OS 버전</th>
                    <th className="border border-gray-200 p-2 text-left font-medium text-gray-700">상태</th>
                    <th className="border border-gray-200 p-2 text-left font-medium text-gray-700">상태 변경 사유</th>
                    <th className="border border-gray-200 p-2 text-left font-medium text-gray-700">변경자</th>
                    <th className="border border-gray-200 p-2 text-left font-medium text-gray-700">변경 시간</th>
                  </tr>
                </thead>
                <tbody>
                {filteredStatusHistory.length > 0 ? (
                  filteredStatusHistory
                      .slice((historyCurrentPage - 1) * historyPerPage, historyCurrentPage * historyPerPage)
                      .map((history, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="border border-gray-200 p-2 whitespace-normal">{history.serialNumber}</td>
                          <td className="border border-gray-200 p-2 whitespace-normal">{history.modelName || 'N/A'}</td>
                          <td className="border border-gray-200 p-2 whitespace-normal">{history.osName || 'N/A'}</td>
                          <td className="border border-gray-200 p-2 whitespace-normal">{history.osVersion || 'N/A'}</td>
                          <td className="border border-gray-200 p-2 whitespace-normal">{history.status || 'N/A'}</td>
                          <td className="border border-gray-200 p-2 whitespace-normal">{history.statusReason || '없음'}</td>
                          <td className="border border-gray-200 p-2 whitespace-normal">{history.performedBy || '알 수 없음'}</td>
                          <td className="border border-gray-200 p-2 whitespace-normal">{new Date(history.timestamp).toLocaleString()}</td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="border border-gray-200 p-2 text-center text-gray-600">상태 변경 이력이 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="mt-4 flex justify-center gap-2">
                <button
                  onClick={() => setHistoryCurrentPage(prev => Math.max(prev - 1, 1))}
                  className={`px-3 py-1 rounded ${historyCurrentPage === 1 ? 'bg-gray-300 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}
                  disabled={historyCurrentPage === 1}
                >
                  이전
                </button>
                {Array.from({ length: Math.ceil(filteredStatusHistory.length / historyPerPage) }, (_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setHistoryCurrentPage(i + 1)}
                    className={`px-3 py-1 rounded ${historyCurrentPage === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setHistoryCurrentPage(prev => Math.min(prev + 1, Math.ceil(statusHistory.length / historyPerPage)))}
                  className={`px-3 py-1 rounded ${historyCurrentPage === Math.ceil(statusHistory.length / historyPerPage) ? 'bg-gray-300 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}
                  disabled={historyCurrentPage === Math.ceil(statusHistory.length / historyPerPage)}
                >
                  다음
                </button>
              </div>
            </div>
          ) : (
            devices.length > 0 ? (
              <div className="overflow-x-auto mx-auto max-w-[1024px]">
                <table className="min-w-full border-collapse bg-white shadow-md rounded-lg">
                  <thead>
                    <tr className="bg-blue-50">
                      {['시리얼 번호', '모델명', 'OS 이름', 'OS 버전', '대여자', '대여일시', '상태', '상태 변경 사유', '액션'].map((header) => (
                        <th
                          key={header}
                          className="border border-gray-200 p-2 text-left font-medium text-gray-700 cursor-pointer"
                          onClick={() => {
                            if (sortField === header) {
                              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortField(header);
                              setSortOrder('asc');
                            }
                          }}
                        >
                          {header} {sortField === header && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentDevices.map(device => (
                      <tr key={device.serialNumber} className="hover:bg-gray-50">
                        <td className="border border-gray-200 p-2 whitespace-normal">{device.serialNumber}</td>
                        <td className="border border-gray-200 p-2 whitespace-normal">{device.modelName || 'N/A'}</td>
                        <td className="border border-gray-200 p-2 whitespace-normal">{device.osName || 'N/A'}</td>
                        <td className="border border-gray-200 p-2 whitespace-normal">{device.osVersion || 'N/A'}</td>
                        <td className="border border-gray-200 p-2 whitespace-normal">
                          {device.rentedBy ? `${device.rentedBy.name} (${device.rentedBy.affiliation || 'N/A'})` : '없음'}
                        </td>
                        <td className="border border-gray-200 p-2 whitespace-normal">
                          {device.rentedAt ? new Date(device.rentedAt).toLocaleString() : '없음'}
                        </td>
                        <td className="border border-gray-200 p-2 whitespace-normal">{device.status || 'N/A'}</td>
                        <td className="border border-gray-200 p-2 whitespace-normal">{device.statusReason || '없음'}</td>
                        <td className="border border-gray-200 p-2">
                          <button
                            onClick={() => openDeleteModal(device.serialNumber)}
                            className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 mr-1 text-sm"
                          >
                            삭제
                          </button>
                          <button
                            onClick={() => openStatusModal(device)}
                            className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                          >
                            상태 변경
                          </button>
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
                      className={`px-3 py-1 rounded  ${currentPage === i + 1 ? '' : 'bg-gray-200 hover:bg-gray-300 hover:shadow-sm'}`}
                      style={currentPage === i + 1 ? { backgroundColor: '#d1d5db', color: 'black', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', fontWeight: 'bold' } : {}}
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
            ) : (
              <p className="text-gray-600 text-center">디바이스 목록이 없습니다.</p>
            )
          )
        )}
        {showDeleteModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            justifyContent: 'center', alignItems: 'center'
          }}>
            <div style={{
              backgroundColor: 'white', padding: '20px', borderRadius: '5px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)', width: '400px', textAlign: 'center'
            }}>
              <h3>삭제하시겠습니까?</h3>
              <div>
                <button
                  onClick={handleDelete}
                  style={{ marginRight: '10px', padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  예
                </button>
                <button
                  onClick={closeDeleteModal}
                  style={{ padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  아니오
                </button>
              </div>
            </div>
          </div>
        )}
        {showStatusModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            justifyContent: 'center', alignItems: 'center'
          }}>
            <div style={{
              backgroundColor: 'white', padding: '20px', borderRadius: '5px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)', width: '400px', textAlign: 'center'
            }}>
              <h3>상태 변경</h3>
              <div style={{ margin: '20px 0' }}>
                <label style={{ marginRight: '10px' }}>상태: </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  style={{ padding: '5px', width: '200px' }}
                >
                  <option value="active">활성화</option>
                  <option value="repair">수리중</option>
                  <option value="inactive">비활성화</option>
                </select>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>사유: </label>
                <textarea
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="상태 변경 사유를 입력하세요"
                  style={{ width: '100%', height: '80px', padding: '5px', resize: 'none' }}
                />
              </div>
              <div>
                <button
                  onClick={handleUpdateStatus}
                  style={{ marginRight: '10px', padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  확인
                </button>
                <button
                  onClick={closeStatusModal}
                  style={{ padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
        {showInitModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            justifyContent: 'center', alignItems: 'center'
          }}>
            <div style={{
              backgroundColor: 'white', padding: '20px', borderRadius: '5px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)', width: '400px', textAlign: 'center'
            }}>
              <h3>정말 초기화 하시겠습니까?</h3>
              <div>
                <button
                  onClick={confirmInit}
                  style={{ marginRight: '10px', padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  예
                </button>
                <button
                  onClick={closeInitModal}
                  style={{ padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  아니오
                </button>
              </div>
            </div>
          </div>
        )}
        {showExportConfirmModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            justifyContent: 'center', alignItems: 'center'
          }}>
            <div style={{
              backgroundColor: 'white', padding: '20px', borderRadius: '5px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)', width: '400px', textAlign: 'center'
            }}>
              <h3>새로 수기로 등록한 디바이스의 정보가 누락 될 수 있습니다. 현재 디바이스 목록을 익스포트 하셨나요?</h3>
              <div>
                <button
                  onClick={confirmExportAndInit}
                  style={{ marginRight: '10px', padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  예
                </button>
                <button
                  onClick={closeExportConfirmModal}
                  style={{ padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  아니오
                </button>
              </div>
            </div>
          </div>
        )}
        {showDownloadModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            justifyContent: 'center', alignItems: 'center'
          }}>
            <div style={{
              backgroundColor: 'white', padding: '20px', borderRadius: '5px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)', width: '400px', textAlign: 'center'
            }}>
              <h3>파일 다운로드</h3>
              <p className="mb-4">파일이 준비되었습니다. 아래 버튼을 눌러 저장해 주세요.</p>
              <p className="mb-4 text-gray-600">파일은 브라우저 기본 다운로드 폴더에 저장됩니다.</p>
              <div>
                <button
                  onClick={handleDownload}
                  style={{ marginRight: '10px', padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  다운로드
                </button>
                <button
                  onClick={closeDownloadModal}
                  style={{ padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceManage;