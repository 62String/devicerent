import React, { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { isMobile as isDetectedMobile } from 'react-device-detect';
import { useAuth } from '../../utils/AuthContext';
import { getTheme, toggleTheme } from '../../utils/theme';
import { DeviceIcon, MoonIcon, SunIcon, LogoutIcon } from '../../components/Icons';
import { canOperateAdmin, canViewDashboard } from '../../utils/permissions';

function ThemeToggle() {
  const [theme, setTheme] = useState(getTheme());
  const themeToggleTitle = theme === 'dark' ? '라이트모드' : '다크모드';
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={`${themeToggleTitle} 전환`}
      title={themeToggleTitle}
      onClick={() => setTheme(toggleTheme())}
    >
      {theme === 'dark' ? <SunIcon size={15} /> : <MoonIcon size={15} />}
    </button>
  );
}

function Navbar({ isMobileView = false }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate(isDetectedMobile || isMobileView ? '/mobile/login' : '/login');
  };

  const handleDevicesNavigation = (event) => {
    event.preventDefault();
    navigate('/devices', { state: { resetDevicesAt: Date.now() } });
  };

  const navLinkClass = ({ isActive }) =>
    isActive ? 'nav-link nav-link-active' : 'nav-link';

  if (isDetectedMobile || isMobileView) {
    return (
      <nav className="navbar">
        <span className="nav-brand">
          <DeviceIcon size={17} />
          DeviceRent
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/portal" className="nav-link">홈</Link>
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

  const pageLabels = {
    '/devices': '대여하기',
    '/devices/status': '대여 현황',
    '/devices/history': '대여 히스토리',
    '/dashboard': '대시보드',
    '/longterm/approvals': '승인 대기',
    '/admin': '관리자',
    '/admin/users': '사용자 관리',
    '/admin/pending': '가입 승인',
    '/admin/export-history': '반출 이력',
    '/admin/change-requests': '디바이스 제보',
    '/devices/manage': '디바이스 관리',
  };
  const currentPage = pageLabels[location.pathname] || 'DeviceRent';

  return (
    <>
      <aside className="device-sidebar" aria-label="DeviceRent 메뉴">
        <Link to="/devices" className="device-sidebar-brand" onClick={handleDevicesNavigation}>
          <span className="device-sidebar-logo"><DeviceIcon size={17} /></span>
          <span>DEVICERENT</span>
        </Link>

        <section className="device-sidebar-section">
          <div className="device-sidebar-heading"><span>대여 관리</span><span>⌄</span></div>
          <nav className="device-sidebar-nav">
            <NavLink to="/devices" end className={navLinkClass} onClick={handleDevicesNavigation}><span className="device-sidebar-nav-icon"><DeviceIcon size={15} /></span>대여하기</NavLink>
            <NavLink to="/devices/status" className={navLinkClass}><span className="device-sidebar-nav-icon">현</span>대여 현황</NavLink>
            <NavLink to="/devices/history" className={navLinkClass}><span className="device-sidebar-nav-icon">력</span>대여 히스토리</NavLink>
          </nav>
        </section>

        {(canViewDashboard(user) || canOperateAdmin(user)) && (
          <section className="device-sidebar-section">
            <div className="device-sidebar-heading"><span>운영 관리</span><span>⌄</span></div>
            <nav className="device-sidebar-nav">
              {canViewDashboard(user) && <NavLink to="/dashboard" className={navLinkClass}><span className="device-sidebar-nav-icon">판</span>대시보드</NavLink>}
              {canOperateAdmin(user) && <NavLink to="/longterm/approvals" className={navLinkClass}><span className="device-sidebar-nav-icon">승</span>승인 대기</NavLink>}
              {canOperateAdmin(user) && <NavLink to="/admin" className={navLinkClass}><span className="device-sidebar-nav-icon">관</span>관리자</NavLink>}
            </nav>
          </section>
        )}
      </aside>

      <header className="device-topbar">
        <div className="device-breadcrumb"><Link to="/portal">홈</Link><span>/</span><span>디바이스 렌트</span><span>/</span><strong>{currentPage}</strong></div>
        <div className="device-topbar-actions">
          <Link to="/portal" className="device-home-button">홈</Link>
          {user && <span className="device-topbar-user"><strong>{user.name}</strong>님</span>}
          <ThemeToggle />
          <button type="button" className="icon-btn" aria-label="로그아웃" title="로그아웃" onClick={handleLogout}>
            <LogoutIcon size={15} />
          </button>
        </div>
      </header>
    </>
  );
}

export default Navbar;
