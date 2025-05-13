import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import BarcodeScanner from './BarcodeScanner';

const MobileDeviceStatus = () => {
  const location = useLocation();
  const [device, setDevice] = useState(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL;

  // API URL 확인
  if (!apiUrl) {
    throw new Error('REACT_APP_API_URL 환경 변수가 설정되지 않았습니다.');
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const serialNumber = params.get('qrcode');
    if (serialNumber) {
      fetchDevice(serialNumber);
    }
  }, [location]);

  const fetchDevice = async (serialNumber) => {
    try {
      const response = await axios.get(`${apiUrl}/api/devices/serial/${serialNumber}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDevice(response.data);
    } catch (err) {
      setError('디바이스를 찾을 수 없습니다.');
    }
  };

  const handleScan = async (code) => {
    try {
      const response = await axios.get(`${apiUrl}/api/devices/serial/${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const device = response.data;
      setDevice(device);

      if (device.status === 'available') {
        await axios.post(`${apiUrl}/api/devices/rent`, { serialNumber: code }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('디바이스가 대여되었습니다.');
      } else if (device.status === 'rented') {
        await axios.post(`${apiUrl}/api/devices/return`, { serialNumber: code }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('디바이스가 반납되었습니다.');
      }

      setDevice(null);
      setScanning(false);
    } catch (err) {
      setError('오류가 발생했습니다. 다시 시도해 주세요.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-2xl mb-4">디바이스 대여/반납</h1>
      {error && <p className="text-red-600 mb-2">{error}</p>}
      {scanning ? (
        <BarcodeScanner onScan={handleScan} />
      ) : (
        <>
          {device ? (
            <div className="text-center">
              <p>시리얼 번호: {device.serialNumber}</p>
              <p>상태: {device.status === 'rented' ? '대여중' : device.status}</p>
            </div>
          ) : (
            <button
              onClick={() => setScanning(true)}
              className="p-2 bg-blue-600 text-white rounded w-3/4"
            >
              QR/바코드 스캔
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default MobileDeviceStatus;