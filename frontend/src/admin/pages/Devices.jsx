import React from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import DeviceStatus from './DeviceStatus';
import DeviceHistory from './DeviceHistory';
import DeviceManage from './DeviceManage';

const DevicesSubMenu = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  console.log('DevicesSubMenu user (AuthContext):', user);

  if (!user) {
    console.log('DevicesSubMenu: Redirecting to /login due to user null');
    navigate('/login');
    return null;
  }

  return (
    <div>
      <h1>디바이스 관리 서브 메뉴</h1>
      <nav>
        <button onClick={() => navigate('/devices')} style={{ marginRight: '10px' }}>
          메인 페이지로 돌아가기
        </button>
        <button onClick={() => navigate('/devices/status')} style={{ marginRight: '10px' }}>
          대여 현황
        </button>
        <button onClick={() => navigate('/devices/history')} style={{ marginRight: '10px' }}>
          대여 히스토리
        </button>
        <button onClick={() => navigate('/devices/manage')} disabled={!user.isAdmin}>
          디바이스 관리 (관리자 전용)
        </button>
      </nav>
      <Routes>
        <Route path="/" element={<DeviceStatus />} />
        <Route path="status" element={<DeviceStatus />} />
        <Route path="history" element={<DeviceHistory />} />
        <Route path="manage" element={<DeviceManage />} />
        <Route path="*" element={<div>404 Not Found</div>} />
      </Routes>
    </div>
  );
};

export default DevicesSubMenu;