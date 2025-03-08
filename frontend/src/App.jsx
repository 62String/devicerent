import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import AdminPage from "./admin/pages/AdminPage";
import SyncPage from "./admin/pages/syncpage";
import UsersPage from "./admin/pages/UsersPage";
import PendingUsersPage from "./admin/pages/PendingUsersPage"; // 추가
import Login from './Login';
import Register from './Register';
import Devices from './Devices';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/sync" element={<SyncPage />} />
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="/admin/pending" element={<PendingUsersPage />} /> {/* 추가 */}
        <Route path="/devices" element={<Devices />} />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;