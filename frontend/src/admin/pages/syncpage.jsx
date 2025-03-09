import React, { useState } from 'react';
import { useAuth } from '../../utils/AuthContext'; // 상위 경로로 이동
import useSync from '../hooks/useSync';
import Popup from '../components/Popup';

function SyncPage() {
  const { user } = useAuth();
  const { syncData, isPopupOpen, error, setIsPopupOpen } = useSync();
  const [loading, setLoading] = useState(false); // 로딩 상태 추가

  if (!user || !user.isAdmin) {
    return <p>관리자 권한이 필요합니다.</p>;
  }

  const handleSync = async () => {
    setLoading(true);
    try {
      await syncData();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>데이터 동기화</h2>
      <button onClick={handleSync} disabled={loading}>
        {loading ? '동기화 중...' : '동기화 실행'}
      </button>
      {isPopupOpen && (
        <Popup
          message="데이터가 성공적으로 동기화되었습니다!"
          onClose={() => setIsPopupOpen(false)}
        />
      )}
      {error && <p style={{ color: 'red', fontWeight: 'bold' }}>{error}</p>}
    </div>
  );
}

export default SyncPage;