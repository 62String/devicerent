import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../utils/AuthContext';

const DeviceManage = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState([]);
  const [newDevice, setNewDevice] = useState({ serialNumber: '', deviceInfo: '', osName: '', osVersion: '', modelName: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [newStatus, setNewStatus] = useState('active');
  const [statusReason, setStatusReason] = useState('');
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  console.log('DeviceManage user:', user);
  console.log('DeviceManage token:', token);
  console.log('DeviceManage apiUrl:', apiUrl);

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
      console.error('Error details:', err.response?.data || err.message || err);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!newDevice.serialNumber || !newDevice.deviceInfo || !newDevice.osName) {
      setMessage('시리얼 번호, 디바이스 정보, OS 이름은 필수 입력 항목입니다.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    try {
      console.log('Sending register request:', { url: `${apiUrl}/api/devices/manage/register`, data: newDevice, headers: { Authorization: `Bearer ${token}` } });
      const response = await axios.post(`${apiUrl}/api/devices/manage/register`, newDevice, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      console.log('DeviceManage handleRegister response:', response.data);
      setMessage(response.data.message);
      setTimeout(() => setMessage(''), 3000);
      setNewDevice({ serialNumber: '', deviceInfo: '', osName: '', osVersion: '', modelName: '' });
      fetchDevices();
    } catch (err) {
      setMessage(err.response?.data?.message || '등록 실패');
      setTimeout(() => setMessage(''), 3000);
      console.error('Error registering device:', err);
      console.error('Error details:', err.response?.data || err.message || err);
      if (err.request) {
        console.error('Request made but no response received:', err.request);
      }
    }
  };

  const handleDelete = async (serialNumber) => {
    if (window.confirm('삭제하시겠습니까?')) {
      try {
        const response = await axios.post(`${apiUrl}/api/devices/manage/delete`, { serialNumber }, {
          headers: { Authorization: `Bearer ${token}` },
          withCredentials: true
        });
        console.log('DeviceManage handleDelete response:', response.data);
        setMessage(response.data.message);
        setTimeout(() => setMessage(''), 3000);
        fetchDevices();
      } catch (err) {
        setMessage('삭제 실패');
        setTimeout(() => setMessage(''), 3000);
        console.error('Error deleting device:', err);
        console.error('Error details:', err.response?.data || err.message || err);
      }
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
      console.log('DeviceManage handleUpdateStatus response:', response.data);
      setMessage(response.data.message);
      setTimeout(() => setMessage(''), 3000);
      fetchDevices();
    } catch (err) {
      setMessage('상태 업데이트 실패');
      setTimeout(() => setMessage(''), 3000);
      console.error('Error updating device status:', err);
      console.error('Error details:', err.response?.data || err.message || err);
    } finally {
      closeStatusModal();
    }
  };

  const handleInitDevices = async (force = false) => {
    try {
      const response = await axios.post(
        `${apiUrl}/api/admin/init-devices`,
        { force },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          withCredentials: true,
        }
      );
      console.log('DeviceManage handleInitDevices response:', response.data);
      setMessage('디바이스 초기화 성공');
      setTimeout(() => setMessage(''), 3000);
      fetchDevices();
    } catch (error) {
      setMessage(error.response?.data?.message || '디바이스 초기화 실패');
      setTimeout(() => setMessage(''), 3000);
      console.error('Device initialization error:', error);
      console.error('Error details:', error.response?.data || error.message || error);
    }
  };

  if (!user || !user.isAdmin) {
    return <div>관리자 권한이 없습니다.</div>;
  }

  return (
    <div>
      <h2>디바이스 관리</h2>
      {message && <div style={{ color: message.includes('실패') ? 'red' : 'green', marginBottom: '10px' }}>{message}</div>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => handleInitDevices(false)} style={{ marginRight: '10px' }}>
          엑셀 초기화 (업데이트)
        </button>
        <button onClick={() => handleInitDevices(true)}>
          엑셀 강제 초기화
        </button>
      </div>
      <form onSubmit={handleRegister} style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={newDevice.serialNumber}
          onChange={(e) => setNewDevice({ ...newDevice, serialNumber: e.target.value })}
          placeholder="시리얼 번호"
          required
        />
        <input
          type="text"
          value={newDevice.deviceInfo}
          onChange={(e) => setNewDevice({ ...newDevice, deviceInfo: e.target.value })}
          placeholder="디바이스 정보"
          required
        />
        <input
          type="text"
          value={newDevice.osName}
          onChange={(e) => setNewDevice({ ...newDevice, osName: e.target.value })}
          placeholder="OS 이름"
          required
        />
        <input
          type="text"
          value={newDevice.osVersion}
          onChange={(e) => setNewDevice({ ...newDevice, osVersion: e.target.value })}
          placeholder="OS 버전"
        />
        <input
          type="text"
          value={newDevice.modelName}
          onChange={(e) => setNewDevice({ ...newDevice, modelName: e.target.value })}
          placeholder="모델명"
        />
        <button type="submit">등록</button>
      </form>
      {!error && devices.length === 0 && <p>디바이스 목록이 없습니다.</p>}
      {!error && devices.length > 0 && (
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
            {devices.map(device => (
              <tr key={device.serialNumber}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.serialNumber}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.modelName}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.osName}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.osVersion}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {device.rentedBy ? `${device.rentedBy.name} (${device.rentedBy.affiliation})` : '없음'}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {device.rentedAt ? new Date(device.rentedAt).toLocaleString() : '없음'}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  <button onClick={() => handleDelete(device.serialNumber)}>삭제</button>
                  <button
                    onClick={() => openStatusModal(device)}
                    style={{ marginLeft: '10px' }}
                  >
                    상태 변경
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 상태 변경 모달 */}
      {showStatusModal && (
        <div style={{
          position: 'fixed',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
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
};

export default DeviceManage;