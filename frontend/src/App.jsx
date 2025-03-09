import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminPage from './admin/pages/AdminPage';
import Devices from './admin/pages/Devices';
import UsersPage from './admin/pages/UsersPage';
import PendingUsersPage from './admin/pages/PendingUsersPage';
import Login from './Login';
import Register from './Register';
import { AuthProvider, useAuth } from './utils/AuthContext';

const ProtectedRoute = ({ element, isAdmin = false }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (isAdmin && !user.isAdmin) return <Navigate to="/devices/status" />;
  return element;
};

function App() {
  return (
    <AuthProvider>
      <Router>
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
            path="/devices/*"
            element={<Devices />}
          />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;