import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';

const AdminPage = () => {
  const { user } = useAuth();

  if (!user || !user.isAdmin) {
    return <div>관리자 권한이 없습니다.</div>;
  }

  return (
    <div>
      <h1>관리자 페이지</h1>
      <nav>
        <ul>
          <li>
            <Link to="/admin/sync">데이터 동기화</Link>
          </li>
          <li>
            <Link to="/admin/users">사용자 목록</Link>
          </li>
          <li>
            <Link to="/admin/pending">승인 대기 목록</Link>
          </li>
          <li>
            <Link to="/devices/manage">디바이스 관리</Link>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default AdminPage;