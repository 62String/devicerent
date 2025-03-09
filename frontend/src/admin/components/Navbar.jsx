import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';

const Navbar = () => {
  const { user } = useAuth();
  const location = useLocation();

  const hideNavbar = ['/login', '/register'].includes(location.pathname);

  if (hideNavbar) return null;

  return (
    <nav style={{ padding: '10px', background: '#f0f0f0' }}>
      <Link to="/devices/status" style={{ marginRight: '10px' }}>대여 현황</Link>
      <Link to="/devices/history" style={{ marginRight: '10px' }}>대여 히스토리</Link>
      {user?.isAdmin && (
        <Link to="/admin" style={{ marginRight: '10px' }}>관리자 페이지</Link>
      )}
      {user ? (
        <button
          onClick={() => {
            localStorage.removeItem('token');
            window.location.href = '/login';
          }}
        >
          로그아웃
        </button>
      ) : (
        <Link to="/login">로그인</Link>
      )}
    </nav>
  );
};

export default Navbar;