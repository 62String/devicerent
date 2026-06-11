import React from 'react';
import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-5xl font-bold text-ink tracking-tight">404</div>
        <p className="text-sm text-sub mt-2 mb-6">페이지를 찾을 수 없습니다.</p>
        <Link to="/login" className="btn btn-ink">홈으로 돌아가기</Link>
      </div>
    </div>
  );
}

export default NotFound;
