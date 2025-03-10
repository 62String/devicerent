import React, { Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminPage from './admin/pages/AdminPage';
import SyncPage from './admin/pages/syncpage';
import DevicesSubMenu from './admin/pages/Devices';
import UsersPage from './admin/pages/UsersPage';
import PendingUsersPage from './admin/pages/PendingUsersPage';
import DeviceManage from './admin/pages/DeviceManage';
import DeviceHistory from './admin/pages/DeviceHistory'; // 경로 확인
import Devices from './Devices';
import DeviceStatus from './admin/pages/DeviceStatus';
import Login from './Login';
import Register from './Register';
import { AuthProvider, useAuth } from './utils/AuthContext';
import Navbar from './admin/components/Navbar';

class ErrorBoundary extends Component {
  state = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
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
        </div>
      );
    }
    return this.props.children;
  }
}

const ProtectedRoute = ({ element, isAdmin = false }) => {
  const { user } = useAuth();
  console.log('ProtectedRoute user:', user);
  console.log('ProtectedRoute isAdmin required:', isAdmin);

  if (!user) {
    console.log('ProtectedRoute: Redirecting to /login due to user null');
    return <Navigate to="/login" replace />;
  }

  if (isAdmin && !user.isAdmin) {
    console.log('ProtectedRoute: Redirecting to /devices due to not admin');
    return <Navigate to="/devices" replace />;
  }

  console.log('ProtectedRoute: Access granted');
  return element;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <ErrorBoundary>
          <Navbar />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/admin"
              element={<ProtectedRoute element={<AdminPage />} isAdmin={true} />}
            />
            <Route
              path="/admin/sync"
              element={<ProtectedRoute element={<SyncPage />} isAdmin={true} />}
            />
            <Route
              path="/admin/users"
              element={<ProtectedRoute element={<UsersPage />} isAdmin={true} />}
            />
            <Route
              path="/admin/pending"
              element={<ProtectedRoute element={<PendingUsersPage />} isAdmin={true} />}
            />
            <Route path="/devices" element={<Devices />} />
            <Route path="/devices/status" element={<DeviceStatus />} />
            <Route path="/devices/history" element={<DeviceHistory />} />
            <Route
              path="/devices/manage"
              element={<ProtectedRoute element={<DeviceManage />} isAdmin={true} />}
            />
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </ErrorBoundary>
      </Router>
    </AuthProvider>
  );
}

export default App;