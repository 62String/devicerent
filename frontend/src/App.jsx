import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import AdminPage from "./admin/pages/AdminPage";
import SyncPage from "./admin/pages/syncpage";
import Login from './Login';
import Register from './Register';
import Devices from './Devices'; // 새로 추가

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/sync" element={<SyncPage />} />
        <Route path="/devices" element={<Devices />} /> {/* 추가 */}
        <Route path="/" element={<Navigate to="/login" />} /> {/* 기본 경로 추가 */}
      </Routes>
    </Router>
  );
}

export default App;