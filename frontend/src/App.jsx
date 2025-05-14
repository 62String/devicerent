import React, { Component, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import AdminPage from './admin/pages/AdminPage';
import UsersPage from './admin/pages/UsersPage';
import PendingUsersPage from './admin/pages/PendingUsersPage';
import DeviceManage from './admin/pages/DeviceManage';
import DeviceHistory from './admin/pages/DeviceHistory';
import Devices from './Devices';
import DeviceStatus from './admin/pages/DeviceStatus';
import Login from './Login';
import MobileLogin from './mobile/MobileLogin';
import Register from './Register';
import ExportHistory from './admin/pages/ExportHistory';
import NotFound from './NotFound';
import MobileDeviceStatus from './mobile/MobileDeviceStatus';
import { AuthProvider, useAuth } from './utils/AuthContext';
import Navbar from './admin/components/Navbar';

// ErrorBoundary 클래스 (기존 유지)
class ErrorBoundary extends Component {
  state = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <h1>문제가 발생했습니다. 다시 시도해 주세요.</h1>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
          <a href={this.state.isMobile ? "/mobile/login" : "/login"}>홈으로 돌아가기</a>
        </div>
      );
    }
    return this.props.children;
  }
}

// ProtectedRoute 컴포넌트
const ProtectedRoute = ({ element, isAdmin = false, isMobile }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (process.env.NODE_ENV === 'development') {
    console.log('ProtectedRoute user:', user);
    console.log('ProtectedRoute loading:', loading);
    console.log('ProtectedRoute isAdmin required:', isAdmin);
    console.log('ProtectedRoute isMobile:', isMobile);
    console.log('ProtectedRoute current path:', location.pathname);
  }

  if (loading) {
    if (process.env.NODE_ENV === 'development') {
      console.log('ProtectedRoute: Rendering loading state');
    }
    return <div>Loading...</div>;
  }

  // /register 경로 → 로그인 없이 접근 허용
  if (location.pathname === '/register') {
    if (process.env.NODE_ENV === 'development') {
      console.log('ProtectedRoute: Allowing access to /register without login');
    }
    return element;
  }

  if (!user) {
    if (process.env.NODE_ENV === 'development') {
      console.log('ProtectedRoute: Redirecting to /login due to user null');
    }
    return <Navigate to={isMobile ? "/mobile/login" : "/login"} replace />;
  }

  // 관리자 권한 확인
  if (isAdmin && !user.isAdmin) {
    const redirectPath = isMobile ? "/mobile/rent" : "/devices";
    if (process.env.NODE_ENV === 'development') {
      console.log(`ProtectedRoute: Redirecting to ${redirectPath} due to not admin`);
    }
    return <Navigate to={redirectPath} replace />;
  }

  // 모바일 디바이스 → 경로 제한
  if (isMobile && !["/mobile/login", "/mobile/rent"].includes(location.pathname)) {
    if (process.env.NODE_ENV === 'development') {
      console.log('ProtectedRoute: Redirecting to /mobile/login due to mobile access');
    }
    return <Navigate to={user ? "/mobile/rent" : "/mobile/login"} replace />;
  }

  // PC 디바이스 → 모바일 경로 제한
  if (!isMobile && ["/mobile/login", "/mobile/rent"].includes(location.pathname)) {
    if (process.env.NODE_ENV === 'development') {
      console.log('ProtectedRoute: Redirecting to /login due to PC access on mobile path');
    }
    return <Navigate to={user ? "/devices" : "/login"} replace />;
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('ProtectedRoute: Access granted');
  }
  return element;
};

function AppContent() {
  const { user, loading } = useAuth();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent;
    const mobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet|Windows Phone/i.test(userAgent);
    const viewportWidth = window.innerWidth <= 768; // 768px 이하 → 모바일
    console.log('User-Agent:', userAgent);
    console.log('isMobile (User-Agent):', mobileDevice);
    console.log('Viewport Width:', window.innerWidth);
    console.log('isMobile (Viewport):', viewportWidth);
    setIsMobile(mobileDevice || viewportWidth);

    const handleResize = () => {
      const newViewportWidth = window.innerWidth <= 768;
      setIsMobile(mobileDevice || newViewportWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (process.env.NODE_ENV === 'development') {
    console.log('AppContent - Current user:', user);
    console.log('AppContent - Loading:', loading);
    console.log('AppContent - isMobile:', isMobile);
  }

  return (
    <ErrorBoundary isMobile={isMobile}>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          {user && <Navbar />}
          <Routes>
            {/* 로그인 페이지 */}
            <Route path="/login" element={<Login />} />
            <Route path="/mobile/login" element={<MobileLogin />} />

            {/* 등록 페이지 */}
            <Route path="/register" element={<ProtectedRoute element={<Register />} isMobile={isMobile} />} />

            {/* 모바일 전용 대여/반납 페이지 */}
            <Route
              path="/mobile/rent"
              element={
                <ProtectedRoute
                  element={<MobileDeviceStatus />}
                  isMobile={isMobile}
                />
              }
            />

            {/* PC 전용 페이지 */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute
                  element={<AdminPage />}
                  isAdmin={true}
                  isMobile={isMobile}
                />
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute
                  element={<UsersPage />}
                  isAdmin={true}
                  isMobile={isMobile}
                />
              }
            />
            <Route
              path="/admin/pending"
              element={
                <ProtectedRoute
                  element={<PendingUsersPage />}
                  isAdmin={true}
                  isMobile={isMobile}
                />
              }
            />
            <Route
              path="/admin/export-history"
              element={
                <ProtectedRoute
                  element={<ExportHistory />}
                  isAdmin={true}
                  isMobile={isMobile}
                />
              }
            />
            <Route
              path="/devices"
              element={
                <ProtectedRoute
                  element={<Devices />}
                  isMobile={isMobile}
                />
              }
            />
            <Route
              path="/devices/status"
              element={
                <ProtectedRoute
                  element={<DeviceStatus />}
                  isMobile={isMobile}
                />
              }
            />
            <Route
              path="/devices/history"
              element={
                <ProtectedRoute
                  element={<DeviceHistory />}
                  isMobile={isMobile}
                />
              }
            />
            <Route
              path="/devices/manage"
              element={
                <ProtectedRoute
                  element={<DeviceManage />}
                  isAdmin={true}
                  isMobile={isMobile}
                />
              }
            />

            {/* 기본 경로 및 404 */}
            <Route
              path="/"
              element={<Navigate to={isMobile ? "/mobile/login" : "/login"} replace />}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </>
      )}
    </ErrorBoundary>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;