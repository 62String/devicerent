import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './utils/AuthContext';
import { getApiUrl } from './utils/api';
import { getTheme, toggleTheme } from './utils/theme';
import { DeviceIcon, LogoutIcon, MoonIcon, SunIcon } from './components/Icons';
import { isMasterAdmin } from './utils/permissions';

const COMMON_WIDGETS = ['device-summary', 'home-calendar', 'my-devices'];
const ADMIN_WIDGETS = ['admin-tools'];

const NAV_GROUPS = [
  {
    key: 'support',
    label: '업무 지원',
    items: [
      { key: 'devicerent', label: '디바이스 렌트', initial: 'D', path: '/devices' },
      { key: 'users', label: '사용자 관리', initial: 'U', path: '/admin/users', masterOnly: true },
    ],
  },
  {
    key: 'work',
    label: '근무 관리',
    items: [
      { key: 'homework', label: '재택 신청', initial: 'H', pending: true },
    ],
  },
  {
    key: 'system',
    label: '시스템',
    items: [
      { key: 'new-system', label: '신규 시스템 추가', initial: '+', pending: true, masterOnly: true },
    ],
  },
];

const WIDGET_LABELS = {
  'device-summary': '디바이스 운영 현황',
  'home-calendar': '재택 캘린더',
  'my-devices': '대여한 디바이스',
  'admin-tools': '관리자 도구',
};

const isPendingExternal = (device) => (
  Boolean(device?.pendingExternalRentalBy) ||
  (['external', 'longterm'].includes(device?.rentalType) && device?.longTermStatus === 'pending')
);

const hasPendingChange = (device) => (
  Boolean(device?.hasPendingChangeRequest) || Boolean(device?.pendingChangeRequests?.length)
);

function ThemeToggle() {
  const [theme, setTheme] = useState(getTheme());
  const themeToggleTitle = theme === 'dark' ? '라이트모드' : '다크모드';

  return (
    <button
      type="button"
      className="icon-btn portal-icon-button"
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
  const apiUrl = getApiUrl();
  const masterAdmin = isMasterAdmin(user);
  const allowedWidgetIds = useMemo(
    () => masterAdmin ? [...COMMON_WIDGETS, ...ADMIN_WIDGETS] : COMMON_WIDGETS,
    [masterAdmin]
  );
  const storageKey = `portal-layout:${user?.id || user?._id || user?.name || 'default'}`;

  const [devices, setDevices] = useState([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [openGroups, setOpenGroups] = useState(['support', 'work', 'system']);
  const [widgetOrder, setWidgetOrder] = useState(allowedWidgetIds);
  const [hiddenWidgets, setHiddenWidgets] = useState([]);
  const [wideWidgets, setWideWidgets] = useState(['device-summary', 'home-calendar']);
  const [draggedWidget, setDraggedWidget] = useState(null);
  const [layoutLoaded, setLayoutLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem('token');

    axios.get(`${apiUrl}/api/devices`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (active) setDevices(Array.isArray(response.data) ? response.data : []);
      })
      .catch(() => {
        if (active) setDevices([]);
      })
      .finally(() => {
        if (active) setIsLoadingDevices(false);
      });

    return () => { active = false; };
  }, [apiUrl]);

  useEffect(() => {
    let savedLayout = null;
    try {
      savedLayout = JSON.parse(localStorage.getItem(storageKey) || 'null');
    } catch (error) {
      savedLayout = null;
    }

    const savedOrder = Array.isArray(savedLayout?.order)
      ? savedLayout.order.filter((id) => allowedWidgetIds.includes(id))
      : [];
    const missingWidgets = allowedWidgetIds.filter((id) => !savedOrder.includes(id));

    setWidgetOrder([...savedOrder, ...missingWidgets]);
    setHiddenWidgets(
      Array.isArray(savedLayout?.hidden)
        ? savedLayout.hidden.filter((id) => allowedWidgetIds.includes(id))
        : []
    );
    setWideWidgets(
      Array.isArray(savedLayout?.wide)
        ? savedLayout.wide.filter((id) => allowedWidgetIds.includes(id))
        : ['device-summary', 'home-calendar']
    );
    setLayoutLoaded(true);
  }, [storageKey, allowedWidgetIds]);

  useEffect(() => {
    if (!layoutLoaded) return;
    localStorage.setItem(storageKey, JSON.stringify({
      order: widgetOrder,
      hidden: hiddenWidgets,
      wide: wideWidgets,
    }));
  }, [hiddenWidgets, layoutLoaded, storageKey, widgetOrder, wideWidgets]);

  const visibleNavGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.masterOnly || masterAdmin),
  })).filter((group) => group.items.length > 0);

  const visibleWidgets = widgetOrder.filter((id) => !hiddenWidgets.includes(id));
  const activeDevices = devices.filter((device) => device?.status === 'active');
  const rentedDevices = activeDevices.filter((device) => Boolean(device?.rentedBy));
  const myDevices = rentedDevices.filter((device) => device.rentedBy?.name === user?.name);
  const availableDevices = activeDevices.filter((device) => (
    !device.rentedBy && !isPendingExternal(device) && !hasPendingChange(device)
  ));

  const handleSystemClick = (item) => {
    if (item.pending) {
      window.alert('아직 준비 중인 시스템입니다.');
      return;
    }
    navigate(item.path);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleGroup = (groupKey) => {
    setOpenGroups((current) => (
      current.includes(groupKey)
        ? current.filter((key) => key !== groupKey)
        : [...current, groupKey]
    ));
  };

  const toggleWidgetWidth = (widgetId) => {
    setWideWidgets((current) => (
      current.includes(widgetId)
        ? current.filter((id) => id !== widgetId)
        : [...current, widgetId]
    ));
  };

  const hideWidget = (widgetId) => {
    setHiddenWidgets((current) => current.includes(widgetId) ? current : [...current, widgetId]);
  };

  const restoreWidget = (widgetId) => {
    setHiddenWidgets((current) => current.filter((id) => id !== widgetId));
  };

  const resetLayout = () => {
    setWidgetOrder(allowedWidgetIds);
    setHiddenWidgets([]);
    setWideWidgets(['device-summary', 'home-calendar']);
  };

  const moveWidget = (targetId) => {
    if (!draggedWidget || draggedWidget === targetId) return;
    setWidgetOrder((current) => {
      const next = current.filter((id) => id !== draggedWidget);
      const targetIndex = next.indexOf(targetId);
      next.splice(targetIndex, 0, draggedWidget);
      return next;
    });
  };

  const renderWidgetControls = (widgetId) => isEditing && (
    <div className="portal-widget-controls">
      <button type="button" onClick={() => toggleWidgetWidth(widgetId)}>
        {wideWidgets.includes(widgetId) ? '절반 크기' : '전체 너비'}
      </button>
      <button type="button" onClick={() => hideWidget(widgetId)}>숨기기</button>
    </div>
  );

  const renderWidget = (widgetId) => {
    if (widgetId === 'device-summary') {
      return (
        <>
          <div className="portal-widget-head">
            <div><span className="portal-widget-eyebrow">DEVICERENT</span><h2>디바이스 운영 현황</h2></div>
            {renderWidgetControls(widgetId)}
          </div>
          <div className="portal-metric-grid">
            <button type="button" onClick={() => navigate('/devices')}>
              <span>전체 운영</span><strong>{isLoadingDevices ? '-' : activeDevices.length}</strong>
            </button>
            <button type="button" onClick={() => navigate('/devices')}>
              <span>대여 가능</span><strong className="portal-value-teal">{isLoadingDevices ? '-' : availableDevices.length}</strong>
            </button>
            <button type="button" onClick={() => navigate('/devices/status')}>
              <span>대여중</span><strong>{isLoadingDevices ? '-' : rentedDevices.length}</strong>
            </button>
            <button type="button" onClick={() => navigate('/devices')}>
              <span>내 대여</span><strong>{isLoadingDevices ? '-' : myDevices.length}</strong>
            </button>
          </div>
        </>
      );
    }

    if (widgetId === 'home-calendar') {
      return (
        <>
          <div className="portal-widget-head">
            <div><span className="portal-widget-eyebrow">WORK</span><h2>재택 캘린더</h2></div>
            {renderWidgetControls(widgetId)}
          </div>
          <div className="portal-calendar-placeholder">
            <span className="portal-calendar-day">10</span>
            <div><strong>재택 시스템 연동 준비 중</strong><p>연동 후 개인 재택 일정이 표시됩니다.</p></div>
          </div>
        </>
      );
    }

    if (widgetId === 'my-devices') {
      return (
        <>
          <div className="portal-widget-head">
            <div><span className="portal-widget-eyebrow">MY RENTAL</span><h2>대여한 디바이스</h2></div>
            {renderWidgetControls(widgetId)}
          </div>
          {isLoadingDevices ? (
            <div className="portal-widget-empty">디바이스 정보를 불러오는 중입니다.</div>
          ) : myDevices.length > 0 ? (
            <div className="portal-device-list">
              {myDevices.slice(0, 3).map((device) => (
                <button type="button" key={device.serialNumber} onClick={() => navigate('/devices')}>
                  <span><strong>{device.modelName || device.deviceInfo || '기기명 없음'}</strong><small>{device.osName} {device.osVersion}</small></span>
                  <code>{device.serialNumber}</code>
                </button>
              ))}
            </div>
          ) : (
            <div className="portal-widget-empty">현재 대여 중인 디바이스가 없습니다.</div>
          )}
        </>
      );
    }

    return (
      <>
        <div className="portal-widget-head">
          <div><span className="portal-widget-eyebrow">ADMIN</span><h2>관리자 도구</h2></div>
          {renderWidgetControls(widgetId)}
        </div>
        <div className="portal-quick-actions">
          <button type="button" onClick={() => navigate('/admin/users')}><span>U</span>사용자 관리</button>
          <button type="button" onClick={() => window.alert('아직 준비 중인 시스템입니다.')}><span>+</span>신규 시스템 추가</button>
        </div>
      </>
    );
  };

  return (
    <div className="portal-page">
      <header className="portal-appbar">
        <div className="portal-brand">
          <span className="portal-brand-mark">G</span>
          <span>QAOS HOME</span>
        </div>
        <span className="portal-appbar-title">업무 시스템 포털</span>
        <div className="portal-actions">
          <span className="portal-user-name">{user?.name}님</span>
          <button
            type="button"
            className={`portal-layout-button ${isEditing ? 'is-active' : ''}`}
            onClick={() => setIsEditing((current) => !current)}
          >
            {isEditing ? '편집 완료' : '레이아웃 편집'}
          </button>
          <ThemeToggle />
          <button type="button" className="icon-btn portal-icon-button" aria-label="로그아웃" title="로그아웃" onClick={handleLogout}>
            <LogoutIcon size={15} />
          </button>
        </div>
      </header>

      <div className="portal-body">
        <aside className="portal-sidebar" aria-label="업무 메뉴">
          <div className="portal-sidebar-title">업무 메뉴</div>
          {visibleNavGroups.map((group) => {
            const isOpen = openGroups.includes(group.key);
            return (
              <section key={group.key} className="portal-nav-group">
                <button type="button" className="portal-nav-group-button" onClick={() => toggleGroup(group.key)} aria-expanded={isOpen}>
                  {group.label}<span className={isOpen ? '' : 'is-closed'}>⌄</span>
                </button>
                {isOpen && (
                  <div className="portal-nav-items">
                    {group.items.map((item) => (
                      <button type="button" key={item.key} className="portal-nav-item" onClick={() => handleSystemClick(item)}>
                        <span className="portal-nav-icon">{item.key === 'devicerent' ? <DeviceIcon size={15} /> : item.initial}</span>
                        {item.label}
                        {item.pending && <small>준비 중</small>}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </aside>

        <main className="portal-content">
          <section className="portal-title-area">
            <div><h1>나의 업무 홈</h1><p>자주 확인하는 업무 정보를 한 화면에서 확인하세요.</p></div>
            {isEditing && <button type="button" className="portal-reset-button" onClick={resetLayout}>기본 배치로 초기화</button>}
          </section>

          {isEditing && (
            <div className="portal-edit-guide">위젯을 끌어서 순서를 바꾸거나 크기와 노출 여부를 조정할 수 있습니다.</div>
          )}

          <section className="portal-widget-grid" aria-label="업무 위젯">
            {visibleWidgets.map((widgetId) => (
              <article
                key={widgetId}
                className={`portal-widget ${wideWidgets.includes(widgetId) ? 'portal-widget-wide' : ''} ${isEditing ? 'is-editing' : ''}`}
                draggable={isEditing}
                onDragStart={() => setDraggedWidget(widgetId)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => moveWidget(widgetId)}
                onDragEnd={() => setDraggedWidget(null)}
              >
                {renderWidget(widgetId)}
              </article>
            ))}
          </section>

          {isEditing && hiddenWidgets.length > 0 && (
            <section className="portal-hidden-widgets">
              <strong>숨긴 위젯</strong>
              <div>
                {hiddenWidgets.map((widgetId) => (
                  <button type="button" key={widgetId} onClick={() => restoreWidget(widgetId)}>
                    + {WIDGET_LABELS[widgetId]}
                  </button>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default Portal;
