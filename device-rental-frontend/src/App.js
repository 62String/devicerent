import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [data, setData] = useState(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await axios.get('http://localhost:4000/api/data');
      setData(response.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const syncData = async () => {
    try {
      const response = await axios.post('http://localhost:4000/api/sync', data);
      setData(response.data);
      setIsPopupOpen(true);
    } catch (error) {
      console.error('Error syncing data:', error);
    }
  };

  return (
    <div>
      <h1>Data Display</h1>
      {data && (
        <table border="1">
          <thead>
            <tr>
              <th>ID</th>
              <th>Device Info</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{data.id}</td>
              <td>{data.deviceInfo}</td>
            </tr>
          </tbody>
        </table>
      )}
      <button onClick={syncData}>데이터 동기화</button>
      {isPopupOpen && (
        <div className="popup">
          <p>데이터가 성공적으로 동기화되었습니다!</p>
          <button onClick={() => setIsPopupOpen(false)}>닫기</button>
        </div>
      )}
    </div>
  );
}

export default App;