import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './utils/AuthContext';

function Devices() {
  const [devices, setDevices] = useState([]);
  const [filteredDevices, setFilteredDevices] = useState([]);
  const [searchSerial, setSearchSerial] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRemarkPrompt, setShowRemarkPrompt] = useState(false);
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showRemarkViewModal, setShowRemarkViewModal] = useState(false);
  const [currentSerialNumber, setCurrentSerialNumber] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('active');
  const [statusReason, setStatusReason] = useState('');
  const [remark, setRemark] = useState('');
  const [selectedRemark, setSelectedRemark] = useState('');
  const [showAllDevices, setShowAllDevices] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const devicesPerPage = 100; // 100개로 설정
  const { user } = useAuth();
  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  console.log('Devices (Main) user:', user);
  console.log('Devices (Main) token:', token);
  console.log('Devices (Main) apiUrl:', apiUrl);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!token) {
      console.log('No token found, redirecting to login');
      setError('No token found, please log in again');
      navigate('/login');
      return;
    }
    try {
      console.log('Fetching devices from:', `${apiUrl}/api/devices`);
      const response = await axios.get(`${apiUrl}/api/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Fetch all devices response:', response.data);
      const activeDevices = (response.data || []).filter(device => device && device.status === 'active');
      console.log('Active devices:', activeDevices);
      setDevices(activeDevices);
      const defaultFiltered = activeDevices.filter(device => 
        device && (!device.rentedBy || (device.rentedBy && device.rentedBy.name === user?.name))
      );
      console.log('Default filtered devices:', defaultFiltered);
      setFilteredDevices(defaultFiltered);
    } catch (error) {
      console.error('Error fetching devices:', error);
      console.error('Error details:', error.response?.data || error.message);
      setError(error.response?.data?.message || 'Failed to fetch devices');
      if (error.response?.status === 401) navigate('/login');
    } finally {
      setLoading(false);
    }
  }, [token, navigate, user]);

  useEffect(() => {
    if (!token || !user) navigate('/login');
    else {
      fetchDevices().then(() => {
        setMessage('디바이스 목록을 성공적으로 불러왔습니다.');
        setTimeout(() => setMessage(''), 3000);
      });
    }
  }, [fetchDevices, token, user, navigate]);

  const filteredAndSortedDevices = filteredDevices
    .filter(device => 
      device && device.serialNumber.toLowerCase().includes(searchSerial.toLowerCase())
    )
    .sort((a, b) => {
      if (!sortField) return 0;
      let aValue = a[sortField] || '';
      let bValue = b[sortField] || '';
      if (sortField === 'rentedAt') {
        aValue = a.rentedAt ? new Date(a.rentedAt).getTime() : 0;
        bValue = b.rentedAt ? new Date(b.rentedAt).getTime() : 0;
      }
      if (aValue == null) return sortOrder === 'asc' ? 1 : -1;
      if (bValue == null) return sortOrder === 'asc' ? -1 : 1;
      return sortOrder === 'asc' ? (aValue > bValue ? 1 : -1) : (bValue > aValue ? 1 : -1);
    });

  const indexOfLastDevice = currentPage * devicesPerPage;
  const indexOfFirstDevice = indexOfLastDevice - devicesPerPage;
  const currentDevices = filteredAndSortedDevices.slice(indexOfFirstDevice, indexOfLastDevice);
  const totalPages = Math.ceil(filteredAndSortedDevices.length / devicesPerPage);

  const toggleShowAllDevices = () => {
    console.log('Toggling show all devices, current state:', showAllDevices);
    setShowAllDevices(prev => !prev);
    if (!showAllDevices) {
      console.log('Showing all active devices');
      setFilteredDevices(devices);
    } else {
      const defaultFiltered = devices.filter(device => 
        device && (!device.rentedBy || (device.rentedBy && device.rentedBy.name === user?.name))
      );
      console.log('Showing default filtered devices:', defaultFiltered);
      setFilteredDevices(defaultFiltered);
    }
    setCurrentPage(1); // 페이지 초기화
  };

  const handleRentDevice = (serialNumber) => {
    if (!serialNumber) {
      console.error('Invalid serialNumber:', serialNumber);
      alert('유효한 디바이스를 선택해 주세요.');
      return;
    }
    console.log('Opening confirm modal for serialNumber:', serialNumber);
    setCurrentSerialNumber(serialNumber);
    setShowConfirmModal(true);
  };

  const confirmRent = () => {
    setShowConfirmModal(false);
    setShowRemarkPrompt(true);
  };

  const handleRemarkPrompt = (hasRemark) => {
    setShowRemarkPrompt(false);
    if (hasRemark) {
      setShowRemarkModal(true);
    } else {
      submitRent();
    }
  };

  const submitRent = async () => {
    if (!currentSerialNumber) {
      alert('대여할 디바이스를 선택해 주세요.');
      return;
    }
    try {
      console.log('Renting device with serialNumber:', currentSerialNumber, 'Token:', token, 'Remark:', remark);
      const payload = { deviceId: currentSerialNumber, remark };
      const response = await axios.post(`${apiUrl}/api/devices/rent-device`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Rent response:', response.data);
      await fetchDevices(); // 디바이스 목록 새로고침
      setMessage('대여가 성공적으로 완료되었습니다.');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Rent error details:', error.response?.data || error.message);
      setMessage(error.response?.data?.message || '대여 실패');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setShowRemarkModal(false);
      setRemark('');
      setCurrentSerialNumber(null);
    }
  };

  const closeRemarkModal = () => {
    console.log('Closing remark input modal');
    setShowRemarkModal(false);
    setRemark('');
    setCurrentSerialNumber(null);
  };

  const openReturnModal = (serialNumber) => {
    if (!serialNumber) {
      console.error('Invalid serialNumber:', serialNumber);
      alert('유효한 디바이스를 선택해 주세요.');
      return;
    }
    console.log('Opening return modal for serialNumber:', serialNumber);
    setCurrentSerialNumber(serialNumber);
    setShowReturnModal(true);
  };

  const closeReturnModal = () => {
    console.log('Closing return modal');
    setShowReturnModal(false);
    setCurrentSerialNumber(null);
  };

  const openStatusModal = () => {
    if (!currentSerialNumber) {
      alert('반납할 디바이스를 선택해 주세요.');
      return;
    }
    console.log('Opening status modal');
    setShowReturnModal(false);
    setShowStatusModal(true);
  };

  const closeStatusModal = () => {
    console.log('Closing status modal');
    setShowStatusModal(false);
    setSelectedStatus('active');
    setStatusReason('');
    setCurrentSerialNumber(null);
  };

  const openRemarkViewModal = (remark) => {
    console.log('Opening remark view modal with remark:', remark);
    setSelectedRemark(remark);
    setShowRemarkViewModal(true);
  };

  const closeRemarkViewModal = () => {
    console.log('Closing remark view modal');
    setShowRemarkViewModal(false);
    setSelectedRemark('');
  };

  const handleReturn = async (withStatusChange = false) => {
    if (!currentSerialNumber) {
      alert('반납할 디바이스를 선택해 주세요.');
      return;
    }
    try {
      console.log('Returning device with serialNumber:', currentSerialNumber, 'Current User:', user, 'With status change:', withStatusChange);
      const payload = withStatusChange ? { deviceId: currentSerialNumber, status: selectedStatus, statusReason } : { deviceId: currentSerialNumber };
      const response = await axios.post(`${apiUrl}/api/devices/return-device`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Return response:', response.data);
      await fetchDevices(); // 디바이스 목록 새로고침
      setMessage('반납이 성공적으로 완료되었습니다.');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Return error details:', error.response?.data || error.message);
      setMessage(error.response?.data?.message || '반납 실패');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      closeReturnModal();
      closeStatusModal();
    }
  };

  const handleSearch = () => {
    console.log('Handling search with serial:', searchSerial);
    if (!searchSerial.trim()) {
      console.log('Search serial empty, resetting based on showAllDevices:', showAllDevices);
      if (showAllDevices) {
        setFilteredDevices(devices);
      } else {
        const defaultFiltered = devices.filter(device => 
          device && (!device.rentedBy || (device.rentedBy && device.rentedBy.name === user?.name))
        );
        setFilteredDevices(defaultFiltered);
      }
    }
    setCurrentPage(1); // 검색 시 페이지 초기화
  };

  const showMyDevices = () => {
    if (!user) return;
    console.log('Showing my devices for user:', user.name);
    const myDevices = devices.filter(device =>
      device && device.rentedBy && device.rentedBy.name === user.name
    );
    console.log('My devices:', myDevices);
    setFilteredDevices(myDevices);
    setCurrentPage(1); // 페이지 초기화
  };

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
        <h2 className="text-2xl font-semibold text-gray-700 mb-4 text-center">디바이스 목록</h2>
        {error && <div className="text-red-500 text-center mb-4 bg-red-100 p-2 rounded">❌ {error}</div>}
        {message && (
          <div className={`text-center mb-4 p-2 rounded ${message.includes('실패') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message.includes('실패') ? '❌' : '✅'} {message}
          </div>
        )}
        <div className="mb-6 flex flex-wrap items-center gap-2 bg-gray-50 p-3 rounded-md justify-center">
          <input
            type="text"
            value={searchSerial}
            onChange={(e) => setSearchSerial(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="시리얼 번호 검색"
            className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={handleSearch} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            검색
          </button>
          <button 
            onClick={() => { 
              console.log('Resetting based on showAllDevices:', showAllDevices);
              setSearchSerial(''); 
              if (showAllDevices) {
                setFilteredDevices(devices);
              } else {
                const defaultFiltered = devices.filter(device => 
                  device && (!device.rentedBy || (device.rentedBy && device.rentedBy.name === user?.name))
                );
                setFilteredDevices(defaultFiltered);
              }
              setCurrentPage(1); // 초기화 시 페이지 리셋
            }} 
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            초기화
          </button>
          <button onClick={showMyDevices} className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600">
            내가 빌린 디바이스
          </button>
          <button onClick={toggleShowAllDevices} className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600">
            {showAllDevices ? '기본 보기' : '모든 디바이스 보기'}
          </button>
        </div>
        {loading ? (
          <p className="text-gray-600 text-center">디바이스 목록을 불러오는 중...</p>
        ) : filteredAndSortedDevices.length > 0 ? (
          <div className="overflow-x-auto mx-auto max-w-[1024px]">
            <table className="min-w-full border-collapse bg-white shadow-md rounded-lg">
              <thead>
                <tr className="bg-blue-50">
                  {['serialNumber', 'modelName', 'osName', 'osVersion', 'rentedBy', 'rentedAt', '특이사항', '액션'].map((header) => (
                    <th
                      key={header}
                      className="border border-gray-200 p-1 text-left font-medium text-gray-700 cursor-pointer min-w-[100px] max-w-[150px] whitespace-normal"
                      onClick={() => {
                        if (header !== '특이사항' && header !== '액션') {
                          if (sortField === header) {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField(header);
                            setSortOrder('asc');
                          }
                        }
                      }}
                    >
                      {header === 'serialNumber' ? '시리얼 번호' :
                        header === 'modelName' ? '모델명' :
                        header === 'osName' ? 'OS 이름' :
                        header === 'osVersion' ? 'OS 버전' :
                        header === 'rentedBy' ? '대여자' :
                        header === 'rentedAt' ? '대여일시' : header} 
                      {sortField === header && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentDevices.map(device => (
                  <tr key={device.serialNumber} className="hover:bg-gray-50">
                    <td className="border border-gray-200 p-2 whitespace-normal">{device.serialNumber || 'N/A'}</td>
                    <td className="border border-gray-200 p-2 whitespace-normal">{device.modelName || 'N/A'}</td>
                    <td className="border border-gray-200 p-2 whitespace-normal">{device.osName || 'N/A'}</td>
                    <td className="border border-gray-200 p-2 whitespace-normal">{device.osVersion || 'N/A'}</td>
                    <td className="border border-gray-200 p-2 whitespace-normal">
                      {device.rentedBy ? `${device.rentedBy.name} (${device.rentedBy.affiliation || 'N/A'})` : '없음'}
                    </td>
                    <td className="border border-gray-200 p-2 whitespace-normal">
                      {device.rentedAt ? new Date(device.rentedAt).toLocaleString() : '없음'}
                    </td>
                    <td className="border border-gray-200 p-2 whitespace-normal">
                      {device.rentedBy && device.remark ? (
                        <button
                          onClick={() => openRemarkViewModal(device.remark)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          보기
                        </button>
                      ) : (
                        '없음'
                      )}
                    </td>
                    <td className="border border-gray-200 p-2">
                      {device.rentedBy ? (
                        user && device.rentedBy.name === user.name ? (
                          <button onClick={() => openReturnModal(device.serialNumber)} className="text-blue-500 hover:underline">[반납]</button>
                        ) : (
                          <span className="text-gray-500">대여중</span>
                        )
                      ) : (
                        <button onClick={() => handleRentDevice(device.serialNumber)} className="text-blue-500 hover:underline">[대여]</button>
                      )}
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
        ) : (
          <p className="text-gray-600 text-center">디바이스 목록이 없습니다.</p>
        )}
        {showConfirmModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            justifyContent: 'center', alignItems: 'center'
          }}>
            <div style={{
              backgroundColor: 'white', padding: '20px', borderRadius: '5px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)', width: '400px', textAlign: 'center'
            }}>
              <h3>대여 하시겠습니까?</h3>
              <div style={{ marginTop: '20px' }}>
                <button
                  onClick={confirmRent}
                  style={{ marginRight: '10px', padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  예
                </button>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  style={{ padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  아니오
                </button>
              </div>
            </div>
          </div>
        )}
        {showRemarkPrompt && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            justifyContent: 'center', alignItems: 'center'
          }}>
            <div style={{
              backgroundColor: 'white', padding: '20px', borderRadius: '5px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)', width: '400px', textAlign: 'center'
            }}>
              <h3>특이사항이 있으십니까?</h3>
              <div style={{ marginTop: '20px' }}>
                <button
                  onClick={() => handleRemarkPrompt(true)}
                  style={{ marginRight: '10px', padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  예
                </button>
                <button
                  onClick={() => handleRemarkPrompt(false)}
                  style={{ padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  아니오
                </button>
              </div>
            </div>
          </div>
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
              <h3>특이사항 입력</h3>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="특이사항을 입력하세요"
                style={{ width: '100%', height: '100px', padding: '5px', margin: '10px 0', resize: 'none' }}
              />
              <div style={{ marginTop: '20px' }}>
                <button
                  onClick={() => {
                    setShowRemarkModal(false);
                    submitRent();
                  }}
                  style={{ marginRight: '10px', padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  확인
                </button>
                <button
                  onClick={closeRemarkModal}
                  style={{ padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
        {showReturnModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            justifyContent: 'center', alignItems: 'center'
          }}>
            <div style={{
              backgroundColor: 'white', padding: '20px', borderRadius: '5px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)', width: '400px', textAlign: 'center'
            }}>
              <h3>기기를 반납 하시겠습니까?</h3>
              <div style={{ marginTop: '20px' }}>
                <button
                  onClick={() => handleReturn(false)}
                  style={{ marginRight: '10px', padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  예
                </button>
                <button
                  onClick={closeReturnModal}
                  style={{ marginRight: '10px', padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  아니오
                </button>
                <button
                  onClick={openStatusModal}
                  style={{ padding: '10px 20px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  상태변경
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
              <h3>기기의 상태를 선택 해 주시고 사유를 입력해주세요</h3>
              <div style={{ margin: '20px 0' }}>
                <label style={{ marginRight: '10px' }}>상태: </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
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
              <div style={{ marginTop: '20px' }}>
                <button
                  onClick={() => handleReturn(true)}
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
        {showRemarkViewModal && (
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
                onClick={closeRemarkViewModal}
                style={{ padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Devices;