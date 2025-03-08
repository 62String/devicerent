import { useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function useSync() {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [error, setError] = useState(null);
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  const syncData = useCallback(async () => {
    if (!token) {
      navigate('/login', { state: { message: 'No token found' } });
      return;
    }

    try {
      const response = await axios.post(`${apiUrl}/api/sync`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Sync response:', response.data);
      setIsPopupOpen(true);
      setError(null);
    } catch (error) {
      console.error('Error syncing data:', error);
      setError(error.response?.data?.message || 'Sync failed');
    }
  }, [token, navigate]);

  return { syncData, isPopupOpen, error, setIsPopupOpen };
}

export default useSync;