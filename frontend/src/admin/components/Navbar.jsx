import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { isMobile } from 'react-device-detect';
import { useAuth } from '../../utils/AuthContext';
import { getTheme, toggleTheme } from '../../utils/theme';
import { DeviceIcon, MoonIcon, SunIcon, LogoutIcon } from '../../components/Icons';

function ThemeToggle() {
  const [theme, setTheme] = useState(getTheme());
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label="다크모드 전환"
      title="다크모드 전환"
      onClick={() => setTheme(toggleTheme())}
    >
      {theme === 'dark' ? <SunIcon size={15} /> : <MoonIcon size={15} />}
    </button>
  );
}

const isTeamLeadOrAbove = (u) => ['팀장', '실장', '센터장'].includes(u?.position);

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate(isMobile ? '/mobile/login' : '/login');
  };

  const navLinkClass = ({ isActive }) =>
    isActive ? 'nav-link nav-link-active' : 'nav-link';

  if (isMobile) {
    return (
      <nav className="navbar">
        <span className="nav-brand">
          <DeviceIcon size={17} />
          DeviceRent
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[13px] text-sub">
            <span className="font-medium text-ink">{user?.name}</span> 님
          </span>
          <ThemeToggle />
          <button type="button" className="icon-btn" aria-label="로그아웃" title="로그아웃" onClick={handleLogout}>
            <LogoutIcon size={15} />
          </button>
        </div>
      </nav>
    );
  }

  return (
    <nav className="navbar">
      <Link to="/devices" className="nav-brand">
        <DeviceIcon size={17} />
        DeviceRent
      </Link>
      <NavLink to="/devices" end className={navLinkClass}>대여하기</NavLink>
      <NavLink to="/devices/status" className={navLinkClass}>대여 현황</NavLink>
      <NavLink to="/devices/history" className={navLinkClass}>대여 히스토리</NavLink>
      {user?.isAdmin && (
        <NavLink to="/dashboard" className={navLinkClass}>대시보드</NavLink>
      )}
      {isTeamLeadOrAbove(user) && (
        <NavLink to="/longterm/approvals" className={navLinkClass}>승인 대기</NavLink>
      )}
      {user?.isAdmin && (
        <NavLink to="/admin" className={navLinkClass}>관리자</NavLink>
      )}
      <div className="ml-auto flex items-center gap-2">
        {user && (
          <span className="text-[13px] text-sub mr-1">
            {user.affiliation} <span className="font-medium text-ink">{user.name}</span> {user.position}
          </span>
        )}
        <ThemeToggle />
        {user ? (
          <button type="button" className="icon-btn" aria-label="로그아웃" title="로그아웃" onClick={handleLogout}>
            <LogoutIcon size={15} />
          </button>
        ) : (
          <Link to="/login" className="nav-link">로그인</Link>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
