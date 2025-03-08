import React from 'react';

function Popup({ message, onClose }) {
  return (
    <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#fff', padding: '20px', border: '1px solid #ccc' }}>
      <p>{message}</p>
      <button onClick={onClose}>닫기</button>
    </div>
  );
}

export default Popup;