import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Devices from './Devices';
import AdminPage from './AdminPage';
import Login from './Login';
import Register from './Register';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<Login />} /> {/* 기본 경로를 로그인 페이지로 */}
      </Routes>
    </Router>
  );
}

export default App;