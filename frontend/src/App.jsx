import React, { Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminPage from './admin/pages/AdminPage';
import UsersPage from './admin/pages/UsersPage';
import PendingUsersPage from './admin/pages/PendingUsersPage';
import DeviceManage from './admin/pages/DeviceManage';
import DeviceHistory from './admin/pages/DeviceHistory';
import Devices from './Devices';
import DeviceStatus from './admin/pages/DeviceStatus';
import Login from './Login';
import Register from './Register';
import ExportHistory from './admin/pages/ExportHistory';
import NotFound from './NotFound';
import { AuthProvider, useAuth } from './utils/AuthContext';
import Navbar from './admin/components/Navbar';

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
          <a href="/login">홈으로 돌아가기</a>
        </div>
      );
    }
    return this.props.children;
  }
}

const ProtectedRoute = ({ element, isAdmin = false }) => {
  const { user, loading } = useAuth();

  if (process.env.NODE_ENV === 'development') {
    console.log('ProtectedRoute user:', user);
    console.log('ProtectedRoute loading:', loading);
    console.log('ProtectedRoute isAdmin required:', isAdmin);
  }

  if (loading) {
    if (process.env.NODE_ENV === 'development') {
      console.log('ProtectedRoute: Rendering loading state');
    }
    return <div>Loading...</div>;
  }

  if (!user) {
    if (process.env.NODE_ENV === 'development') {
      console.log('ProtectedRoute: Redirecting to /login due to user null');
    }
    return <Navigate to="/login" replace />;
  }

  if (isAdmin && !user.isAdmin) {
    if (process.env.NODE_ENV === 'development') {
      console.log('ProtectedRoute: Redirecting to /devices due to not admin');
    }
    return <Navigate to="/devices" replace />;
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('ProtectedRoute: Access granted');
  }
  return element;
};

function AppContent() {
  const { user, loading } = useAuth();

  if (process.env.NODE_ENV === 'development') {
    console.log('AppContent - Current user:', user);
    console.log('AppContent - Loading:', loading);
  }

  return (
    <ErrorBoundary>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          {user && <Navbar />}
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/admin"
              element={<ProtectedRoute element={<AdminPage />} isAdmin={true} />}
            />
            <Route
              path="/admin/users"
              element={<ProtectedRoute element={<UsersPage />} isAdmin={true} />}
            />
            <Route
              path="/admin/pending"
              element={<ProtectedRoute element={<PendingUsersPage />} isAdmin={true} />}
            />
            <Route
              path="/admin/export-history"
              element={<ProtectedRoute element={<ExportHistory />} isAdmin={true} />}
            />
            <Route path="/devices" element={<ProtectedRoute element={<Devices />} />} />
            <Route path="/devices/status" element={<ProtectedRoute element={<DeviceStatus />} />} />
            <Route path="/devices/history" element={<ProtectedRoute element={<DeviceHistory />} />} />
            <Route
              path="/devices/manage"
              element={<ProtectedRoute element={<DeviceManage />} isAdmin={true} />}
            />
            <Route path="/" element={<Navigate to="/login" replace />} />
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