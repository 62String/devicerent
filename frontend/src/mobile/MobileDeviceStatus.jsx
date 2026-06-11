import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import BarcodeScanner from './BarcodeScanner';
import { ScanIcon } from '../components/Icons';

const MobileDeviceStatus = () => {
  const location = useLocation();
  const [device, setDevice] = useState(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4000`;

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
    <div className="min-h-screen bg-paper px-5 py-8">
      <div className="max-w-[400px] mx-auto">
        <h1 className="page-title" style={{ fontSize: 20 }}>대여 / 반납</h1>
        <p className="page-sub mb-5">디바이스의 QR 코드 또는 바코드를 스캔하세요</p>

        {error && <div className="alert alert-error">{error}</div>}

        {scanning ? (
          <div className="card overflow-hidden">
            <BarcodeScanner onScan={handleScan} onError={(msg) => { setError(msg); setScanning(false); }} />
            <div className="p-3">
              <button onClick={() => setScanning(false)} className="btn btn-outline w-full">스캔 취소</button>
            </div>
          </div>
        ) : (
          <>
            {device ? (
              <div className="card" style={{ borderTop: '2px solid var(--ink)' }}>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="td-mono" style={{ fontSize: 14 }}>{device.serialNumber}</span>
                    <span className={`badge ${device.status === 'rented' ? 'badge-warn' : 'badge-ok'}`}>
                      {device.status === 'rented' ? '대여중' : device.status}
                    </span>
                  </div>
                  {device.modelName && (
                    <div className="text-sm font-bold text-ink">{device.modelName}</div>
                  )}
                  <button onClick={() => setDevice(null)} className="btn btn-outline w-full mt-4">닫기</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setScanning(true)}
                className="btn btn-ink w-full"
                style={{ padding: '14px 16px', fontSize: 14 }}
              >
                <ScanIcon size={18} />
                QR / 바코드 스캔
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MobileDeviceStatus;
