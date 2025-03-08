import React from 'react';
import useSync from '../hooks/useSync';
import Popup from '../components/Popup';

function SyncPage() {
  const { syncData, isPopupOpen, error, setIsPopupOpen } = useSync();

  return (
    <div>
      <h2>데이터 동기화</h2>
      <button onClick={syncData}>동기화 실행</button>
      {isPopupOpen && <Popup message="데이터가 성공적으로 동기화되었습니다!" onClose={() => setIsPopupOpen(false)} />}
      {error && <p style={{ color: 'red', fontWeight: 'bold' }}>{error}</p>}
    </div>
  );
}

export default SyncPage;