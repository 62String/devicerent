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
  const [showRentModal, setShowRentModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [currentSerialNumber, setCurrentSerialNumber] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('active');
  const [statusReason, setStatusReason] = useState('');
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
      setError('No token found, please log in again');
      navigate('/login');
      return;
    }
    try {
      const response = await axios.get(`${apiUrl}/api/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Fetch all devices response:', response.data);
      setDevices(response.data || []); // null 방지
      const filtered = (response.data || []).filter(device => 
        device && (device.status === 'active' && !device.rentedBy || 
        (device.rentedBy && device.rentedBy.name === user?.name))
      );
      setFilteredDevices(filtered);
    } catch (error) {
      console.error('Error fetching devices:', error);
      setError(error.response?.data?.message || 'Failed to fetch devices');
      if (error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [token, navigate, user]);

  useEffect(() => {
    if (!token || !user) {
      navigate('/login');
      return;
    }
    fetchDevices();
  }, [fetchDevices, token, user, navigate]);

  const openRentModal = (serialNumber) => {
    if (!serialNumber) {
      console.error('Invalid serialNumber:', serialNumber);
      alert('유효한 디바이스를 선택해 주세요.');
      return;
    }
    setCurrentSerialNumber(serialNumber);
    setShowRentModal(true);
  };

  const closeRentModal = () => {
    setShowRentModal(false);
    setCurrentSerialNumber(null);
  };

  const openReturnModal = (serialNumber) => {
    if (!serialNumber) {
      console.error('Invalid serialNumber:', serialNumber);
      alert('유효한 디바이스를 선택해 주세요.');
      return;
    }
    setCurrentSerialNumber(serialNumber);
    setShowReturnModal(true);
  };

  const closeReturnModal = () => {
    setShowReturnModal(false);
    setCurrentSerialNumber(null);
  };

  const openStatusModal = () => {
    if (!currentSerialNumber) {
      alert('반납할 디바이스를 선택해 주세요.');
      return;
    }
    setShowReturnModal(false);
    setShowStatusModal(true);
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setSelectedStatus('active');
    setStatusReason('');
    setCurrentSerialNumber(null);
  };

  const handleRent = async () => {
    if (!currentSerialNumber) {
      alert('대여할 디바이스를 선택해 주세요.');
      return;
    }
    try {
      console.log('Renting device with serialNumber:', currentSerialNumber, 'Token:', token);
      const response = await axios.post(`${apiUrl}/api/devices/rent-device`, { deviceId: currentSerialNumber }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Rent response:', response.data);
      alert(response.data.message);
      fetchDevices();
    } catch (error) {
      console.error('Rent error details:', error.response?.data || error.message);
      alert(error.response?.data?.message || 'Rent failed');
    } finally {
      closeRentModal();
    }
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
      alert('반납이 성공되었습니다');
      fetchDevices();
    } catch (error) {
      console.error('Return error details:', error.response?.data || error.message);
      alert(error.response?.data?.message || 'Return failed');
    } finally {
      closeReturnModal();
      closeStatusModal();
    }
  };

  const handleSearch = () => {
    if (!searchSerial.trim()) {
      setFilteredDevices(devices.filter(device => 
        device && (device.status === 'active' && !device.rentedBy || 
        (device.rentedBy && device.rentedBy.name === user?.name))
      ));
      return;
    }
    const filtered = devices.filter(device => 
      device && device.serialNumber.toLowerCase().includes(searchSerial.toLowerCase()) &&
      (device.status === 'active' && !device.rentedBy || 
       (device.rentedBy && device.rentedBy.name === user?.name))
    );
    setFilteredDevices(filtered);
  };

  const showMyDevices = () => {
    if (!user) return;
    const myDevices = devices.filter(device =>
      device && device.rentedBy && device.rentedBy.name === user.name
    );
    setFilteredDevices(myDevices);
  };

  return (
    <div>
      <h1>Device Rental System</h1>
      {user && (
        <div style={{ marginBottom: '20px' }}>
          {user.isAdmin && (
            <>
              <button onClick={() => navigate('/admin')} style={{ marginRight: '10px' }}>
                관리자 페이지
              </button>
              <button onClick={() => navigate('/devices/status')} style={{ marginRight: '10px' }}>
                대여 현황
              </button>
              <button onClick={() => navigate('/devices/history')} style={{ marginRight: '10px' }}>
                대여 히스토리
              </button>
              <button onClick={() => navigate('/devices/manage')} style={{ marginRight: '10px' }}>
                디바이스 관리
              </button>
            </>
          )}
        </div>
      )}
      <h2>디바이스 목록</h2>
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={searchSerial}
          onChange={(e) => setSearchSerial(e.target.value)}
          placeholder="시리얼 번호 검색"
          style={{ padding: '5px', marginRight: '10px' }}
        />
        <button onClick={handleSearch}>검색</button>
        <button 
          onClick={() => { 
            setSearchSerial(''); 
            setFilteredDevices(devices.filter(device => 
              device && (device.status === 'active' && !device.rentedBy || 
              (device.rentedBy && device.rentedBy.name === user?.name))
            ));
          }} 
          style={{ marginLeft: '10px' }}
        >
          초기화
        </button>
        <button onClick={showMyDevices} style={{ marginLeft: '10px' }}>
          내가 빌린 디바이스
        </button>
      </div>
      {loading ? (
        <p>디바이스 목록을 불러오는 중...</p>
      ) : error ? (
        <p style={{ color: 'red', fontWeight: 'bold' }}>{error}</p>
      ) : filteredDevices.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>시리얼 번호</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>모델명</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>OS 이름</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>OS 버전</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>대여자</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>대여일시</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>액션</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map(device => (
              <tr key={device.serialNumber}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.serialNumber || 'N/A'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.modelName || 'N/A'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.osName || 'N/A'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.osVersion || 'N/A'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {device.rentedBy ? `${device.rentedBy.name} (${device.rentedBy.affiliation || 'N/A'})` : '없음'}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {device.rentedAt ? new Date(device.rentedAt).toLocaleString() : '없음'}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {device.rentedBy ? (
                    user && device.rentedBy.name === user.name ? (
                      <button onClick={() => openReturnModal(device.serialNumber)}>[반납]</button>
                    ) : (
                      <span>대여중</span>
                    )
                  ) : (
                    <button onClick={() => openRentModal(device.serialNumber)}>[대여]</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>디바이스 목록이 없습니다.</p>
      )}
      {/* 대여 확인 모달 */}
      {showRentModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '5px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
            width: '400px',
            textAlign: 'center'
          }}>
            <h3>대여 하시겠습니까?</h3>
            <div style={{ marginTop: '20px' }}>
              <button
                onClick={handleRent}
                style={{
                  marginRight: '10px',
                  padding: '10px 20px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                예
              </button>
              <button
                onClick={closeRentModal}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                아니오
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 반납 확인 모달 */}
      {showReturnModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '5px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
            width: '400px',
            textAlign: 'center'
          }}>
            <h3>기기를 반납 하시겠습니까?</h3>
            <div style={{ marginTop: '20px' }}>
              <button
                onClick={() => handleReturn(false)}
                style={{
                  marginRight: '10px',
                  padding: '10px 20px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                예
              </button>
              <button
                onClick={closeReturnModal}
                style={{
                  marginRight: '10px',
                  padding: '10px 20px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                아니오
              </button>
              <button
                onClick={openStatusModal}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                상태변경
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상태 변경 모달 */}
      {showStatusModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '5px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
            width: '400px',
            textAlign: 'center'
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
            <div>
              <button
                onClick={() => handleReturn(true)}
                style={{
                  marginRight: '10px',
                  padding: '10px 20px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                확인
              </button>
              <button
                onClick={closeStatusModal}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Devices;