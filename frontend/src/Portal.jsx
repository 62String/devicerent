import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './utils/AuthContext';
import { getTheme, toggleTheme } from './utils/theme';
import { DeviceIcon, LogoutIcon, MoonIcon, SunIcon } from './components/Icons';
import { isMasterAdmin } from './utils/permissions';

const systems = [
  {
    key: 'devicerent',
    initial: 'D',
    title: 'DeviceRent',
    description: '모바일 기기 대여, 반납, 외부 반출 승인, 기기 상태 관리를 처리합니다.',
    action: 'open',
    path: '/devices',
  },
  {
    key: 'homework',
    initial: 'H',
    title: '재택 신청',
    description: '재택근무 신청과 승인 현황을 확인하는 업무 시스템입니다.',
    action: 'pending',
  },
  {
    key: 'users',
    initial: 'U',
    title: '사용자 관리',
    description: '계정, 권한, 조직 정보를 관리자가 확인하는 영역입니다.',
    action: 'admin',
    path: '/admin/users',
  },
  {
    key: 'new-system',
    initial: '+',
    title: '신규 시스템 추가',
    description: '추가 예정인 사내 업무 시스템을 이 포털에 연결합니다.',
    action: 'pending',
  },
];

function ThemeToggle() {
  const [theme, setTheme] = React.useState(getTheme());
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

function Portal() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleSystemClick = (system) => {
    if (system.action === 'pending') {
      window.alert('아직 준비 중인 시스템입니다.');
      return;
    }

    if (system.action === 'admin' && !isMasterAdmin(user)) {
      window.alert('마스터 관리자 권한이 필요한 시스템입니다.');
      return;
    }

    navigate(system.path);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="portal-page">
      <header className="portal-appbar">
        <div className="portal-brand">
          <span className="portal-brand-mark">G</span>
          <span>GameDex Portal</span>
        </div>
        <div className="portal-actions">
          <span className="portal-user-name">{user?.name}님</span>
          <ThemeToggle />
          <button type="button" className="icon-btn" aria-label="로그아웃" title="로그아웃" onClick={handleLogout}>
            <LogoutIcon size={15} />
          </button>
        </div>
      </header>

      <main className="portal-content">
        <section className="portal-title-area">
          <div>
            <h1>업무 시스템</h1>
            <p>사용할 사내 시스템을 선택하세요.</p>
          </div>
        </section>

        <section className="portal-system-grid" aria-label="업무 시스템 목록">
          {systems.map((system) => (
            <button
              key={system.key}
              type="button"
              className="portal-system-card"
              onClick={() => handleSystemClick(system)}
            >
              <span className="portal-system-icon" aria-hidden="true">
                {system.key === 'devicerent' ? <DeviceIcon size={24} /> : system.initial}
              </span>
              <span className="portal-system-copy">
                <strong>{system.title}</strong>
                <span>{system.description}</span>
              </span>
              <span className="portal-system-action">페이지 이동</span>
            </button>
          ))}
        </section>
      </main>
    </div>
  );
}

export default Portal;
