import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom'; // Link 임포트 추가
import { useAuth } from '../../utils/AuthContext';

const DeviceStatus = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [filteredDevices, setFilteredDevices] = useState([]);
  const [searchSerial, setSearchSerial] = useState('');
  const [error, setError] = useState(null);
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [selectedRemark, setSelectedRemark] = useState('');
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  console.log('DeviceStatus initialized - token:', token);
  console.log('DeviceStatus initialized - apiUrl:', apiUrl);

  useEffect(() => {
    if (!token) {
      console.log('No token found, setting error');
      setError('토큰이 없습니다. 로그인 해 주세요.');
      return;
    }
    fetchStatus();
  }, [token]);

  const fetchStatus = async () => {
    try {
      console.log('Fetching device status from:', `${apiUrl}/api/devices/status`);
      const response = await axios.get(`${apiUrl}/api/devices/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('DeviceStatus fetchStatus response:', response.data);
      if (response.data && Array.isArray(response.data)) {
        console.log('Data received, setting devices:', response.data);
        setDevices(response.data);
        setFilteredDevices(response.data);
      } else {
        console.log('No valid data received, resetting devices');
        setDevices([]);
        setFilteredDevices([]);
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching device status:', err);
      console.error('Error details:', err.response?.data || err.message);
      setError('디바이스 상태를 불러오지 못했습니다. 서버를 확인해 주세요.');
    }
  };

  const handleSearch = () => {
    console.log('Handling search with serial:', searchSerial);
    if (!searchSerial.trim()) {
      console.log('Search serial empty, resetting to all devices');
      setFilteredDevices(devices);
      return;
    }
    const filtered = devices.filter(device => 
      device && device.serialNumber.toLowerCase().includes(searchSerial.toLowerCase())
    );
    console.log('Filtered devices:', filtered);
    setFilteredDevices(filtered);
  };

  const handleReset = () => {
    console.log('Resetting search');
    setSearchSerial('');
    setFilteredDevices(devices);
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
        <h2 className="text-2xl font-semibold text-gray-700 mb-4 text-center">현재 대여 현황</h2>
        <div className="mb-6 flex flex-wrap items-center gap-2 bg-gray-50 p-3 rounded-md justify-center">
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
        </div>
        {error && <p className="text-red-500 text-center">{error}</p>}
        {!error && filteredDevices.length === 0 && <p className="text-gray-600 text-center">대여 중인 디바이스가 없습니다.</p>}
        {!error && filteredDevices.length > 0 && (
          <div className="overflow-x-auto mx-auto max-w-[1024px]">
            <table className="min-w-[1024px] border-collapse bg-white shadow-md rounded-lg">
              <thead>
                <tr className="bg-blue-50">
                  <th className="border border-gray-200 p-2 text-left font-medium text-gray-700">시리얼 번호</th>
                  <th className="border border-gray-200 p-2 text-left font-medium text-gray-700">모델명</th>
                  <th className="border border-gray-200 p-2 text-left font-medium text-gray-700">OS 이름</th>
                  <th className="border border-gray-200 p-2 text-left font-medium text-gray-700">OS 버전</th>
                  <th className="border border-gray-200 p-2 text-left font-medium text-gray-700">대여자</th>
                  <th className="border border-gray-200 p-2 text-left font-medium text-gray-700">대여일시</th>
                  <th className="border border-gray-200 p-2 text-left font-medium text-gray-700">특이사항</th>
                </tr>
              </thead>
              <tbody>
                {filteredDevices.map(device => (
                  <tr key={device.serialNumber} className="hover:bg-gray-50">
                    <td className="border border-gray-200 p-2">{device.serialNumber || 'N/A'}</td>
                    <td className="border border-gray-200 p-2">{device.modelName || 'N/A'}</td>
                    <td className="border border-gray-200 p-2">{device.osName || 'N/A'}</td>
                    <td className="border border-gray-200 p-2">{device.osVersion || 'N/A'}</td>
                    <td className="border border-gray-200 p-2">
                      {device.rentedBy ? `${device.rentedBy.name} (${device.rentedBy.affiliation || 'N/A'})` : '없음'}
                    </td>
                    <td className="border border-gray-200 p-2">
                      {device.rentedAt ? new Date(device.rentedAt).toLocaleString() : '없음'}
                    </td>
                    <td className="border border-gray-200 p-2">
                      {device.remark ? (
                        <button
                          onClick={() => openRemarkModal(device.remark)}
                          className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          보기
                        </button>
                      ) : '없음'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
    </div>
  );
};

export default DeviceStatus;