import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  console.log('Navbar - Current user:', user); // 사용자 상태 확인

  const handleLogout = () => {
    console.log('Navbar - Logging out user:', user);
    logout();
    navigate('/login');
  };

  return (
    <nav style={{ backgroundColor: '#333', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: '20px' }}>
        <Link to="/devices" style={{ color: 'white', textDecoration: 'none' }}>대여하기</Link>
        <Link to="/devices/status" style={{ color: 'white', textDecoration: 'none' }}>대여 현황</Link>
        {user && user.isAdmin && (
          <Link to="/admin" style={{ color: 'white', textDecoration: 'none' }}>Admin</Link>
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
          <Link to="/login" style={{ color: 'white', textDecoration: 'none' }}>Login</Link>
        )}
      </div>
    </nav>
  );
}

export default Navbar;