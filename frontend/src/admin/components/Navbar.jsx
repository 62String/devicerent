import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isMobile } from 'react-device-detect';
import { useAuth } from '../../utils/AuthContext';

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  console.log('Navbar - Current user:', user);

  const handleLogout = () => {
    console.log('Navbar - Logging out user:', user);
    logout();
    navigate(isMobile ? '/mobile/login' : '/login');
  };

  return (
    <nav style={{ backgroundColor: '#333', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      {isMobile ? (
        // 모바일 전용 네비게이션 바
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <span style={{ color: 'white' }}>
            반갑습니다 {user.name} 님!
          </span>
          <button
            onClick={handleLogout}
            style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Logout
          </button>
        </div>
      ) : (
        // PC 전용 네비게이션 바
        <>
          <div style={{ display: 'flex', gap: '20px' }}>
            <Link to="/devices" style={{ color: 'white', textDecoration: 'none' }}>
              대여하기
            </Link>
            <Link to="/devices/status" style={{ color: 'white', textDecoration: 'none' }}>
              대여 현황
            </Link>
            <Link to="/devices/history" style={{ color: 'white', textDecoration: 'none' }}>
              대여 히스토리
            </Link>
            {user && user.isAdmin && (
              <Link to="/admin" style={{ color: 'white', textDecoration: 'none' }}>
                Admin
              </Link>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {user && (
              <span style={{ color: 'white' }}>
                환영합니다 {user.affiliation} {user.name} {user.position} 님
              </span>
            )}
            {user ? (
              <button
                onClick={handleLogout}
                style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Logout
              </button>
            ) : (
              <Link to="/login" style={{ color: 'white', textDecoration: 'none' }}>
                Login
              </Link>
            )}
          </div>
        </>
      )}
    </nav>
  );
}

export default Navbar;