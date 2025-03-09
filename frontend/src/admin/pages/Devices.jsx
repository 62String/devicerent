import React, { useState, useEffect } from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import axios from 'axios';

const DeviceStatus = () => {
  const [devices, setDevices] = useState([]);
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/devices/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDevices(response.data);
    } catch (err) {
      console.error('Error fetching device status:', err);
    }
  };

  return (
    <div>
      <h2>현재 대여 현황</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>시리얼 번호</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>모델명</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>대여자</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>대여 시간</th>
          </tr>
        </thead>
        <tbody>
          {devices.map(device => (
            <tr key={device.serialNumber}>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.serialNumber}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.modelName}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.rentedBy?.name || '없음'}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.rentedAt ? new Date(device.rentedAt).toLocaleString() : '없음'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DeviceHistory = () => {
  const [history, setHistory] = useState([]);
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/devices/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(response.data);
    } catch (err) {
      console.error('Error fetching device history:', err);
    }
  };

  return (
    <div>
      <h2>대여 히스토리</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>시리얼 번호</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>사용자 ID</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>이름</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>소속</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>동작</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>시간</th>
          </tr>
        </thead>
        <tbody>
          {history.map((record, index) => (
            <tr key={index}>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{record.serialNumber}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{record.userId}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{record.userDetails.name}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{record.userDetails.affiliation}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{record.action}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{new Date(record.timestamp).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DeviceManage = () => {
  const [devices, setDevices] = useState([]);
  const [newDevice, setNewDevice] = useState({ serialNumber: '', deviceInfo: '', osName: '', osVersion: '', modelName: '' });
  const [message, setMessage] = useState('');
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/devices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDevices(response.data);
    } catch (err) {
      console.error('Error fetching devices:', err);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${apiUrl}/api/devices/manage/register`, newDevice, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage(response.data.message);
      setTimeout(() => setMessage(''), 3000);
      setNewDevice({ serialNumber: '', deviceInfo: '', osName: '', osVersion: '', modelName: '' });
      fetchDevices();
    } catch (err) {
      setMessage('등록 실패');
      setTimeout(() => setMessage(''), 3000);
      console.error('Error registering device:', err);
    }
  };

  const handleDelete = async (serialNumber) => {
    if (window.confirm('삭제하시겠습니까?')) {
      try {
        const response = await axios.post(`${apiUrl}/api/devices/manage/delete`, { serialNumber }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessage(response.data.message);
        setTimeout(() => setMessage(''), 3000);
        fetchDevices();
      } catch (err) {
        setMessage('삭제 실패');
        setTimeout(() => setMessage(''), 3000);
        console.error('Error deleting device:', err);
      }
    }
  };

  const handleUpdateStatus = async (serialNumber, status) => {
    try {
      const response = await axios.post(`${apiUrl}/api/devices/manage/update-status`, { serialNumber, status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage(response.data.message);
      setTimeout(() => setMessage(''), 3000);
      fetchDevices();
    } catch (err) {
      setMessage('상태 업데이트 실패');
      setTimeout(() => setMessage(''), 3000);
      console.error('Error updating device status:', err);
    }
  };

  return (
    <div>
      <h2>디바이스 관리</h2>
      {message && <div style={{ color: 'green', marginBottom: '10px' }}>{message}</div>}
      <form onSubmit={handleRegister} style={{ marginBottom: '20px' }}>
        <input type="text" value={newDevice.serialNumber} onChange={(e) => setNewDevice({ ...newDevice, serialNumber: e.target.value })} placeholder="시리얼 번호" required />
        <input type="text" value={newDevice.deviceInfo} onChange={(e) => setNewDevice({ ...newDevice, deviceInfo: e.target.value })} placeholder="디바이스 정보" required />
        <input type="text" value={newDevice.osName} onChange={(e) => setNewDevice({ ...newDevice, osName: e.target.value })} placeholder="OS 이름" required />
        <input type="text" value={newDevice.osVersion} onChange={(e) => setNewDevice({ ...newDevice, osVersion: e.target.value })} placeholder="OS 버전" />
        <input type="text" value={newDevice.modelName} onChange={(e) => setNewDevice({ ...newDevice, modelName: e.target.value })} placeholder="모델명" />
        <button type="submit">등록</button>
      </form>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>시리얼 번호</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>모델명</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>상태</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>액션</th>
          </tr>
        </thead>
        <tbody>
          {devices.map(device => (
            <tr key={device.serialNumber}>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.serialNumber}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.modelName}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{device.status}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                <button onClick={() => handleDelete(device.serialNumber)}>삭제</button>
                {device.status !== 'inactive' && (
                  <>
                    <button onClick={() => handleUpdateStatus(device.serialNumber, 'repair')}>수리중</button>
                    <button onClick={() => handleUpdateStatus(device.serialNumber, 'inactive')}>비활성화</button>
                  </>
                )}
                {device.status === 'repair' && (
                  <button onClick={() => handleUpdateStatus(device.serialNumber, 'active')}>활성화</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Devices = () => {
  const navigate = useNavigate();

  return (
    <div>
      <h1>디바이스 관리</h1>
      <nav>
        <button onClick={() => navigate('/devices/status')}>대여 현황</button>
        <button onClick={() => navigate('/devices/history')}>대여 히스토리</button>
        <button onClick={() => navigate('/devices/manage')}>디바이스 관리</button>
      </nav>
      <Routes>
        <Route path="status" element={<DeviceStatus />} />
        <Route path="history" element={<DeviceHistory />} />
        <Route path="manage" element={<DeviceManage />} />
      </Routes>
    </div>
  );
};

export default Devices;