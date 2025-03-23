import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    console.log('Initial user from localStorage:', storedUser);
    if (!storedUser || storedUser === 'undefined') {
      console.log('No valid user data in localStorage, returning null');
      return null;
    }
    try {
      return JSON.parse(storedUser);
    } catch (error) {
      console.error('Error parsing stored user data:', error.message);
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setLoading(true);
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        console.log('AuthContext - Stored User:', storedUser);
        console.log('AuthContext - Token:', token);

        if (!token) {
          console.log('No token found, skipping auth initialization');
          if (!['/login', '/register'].includes(window.location.pathname)) {
            window.location.href = '/login';
          }
          return;
        }

        if (storedUser && storedUser !== 'undefined') {
          try {
            const parsedUser = JSON.parse(storedUser);
            console.log('Setting user from stored data:', parsedUser);
            setUser(parsedUser); // 로컬 데이터로 상태 복원
          } catch (error) {
            console.error('Error parsing stored user data in useEffect:', error.message);
            setUser(null);
            localStorage.removeItem('user');
          }
        } else {
          console.log('No valid stored user data, proceeding with API call');
        }

        console.log('Fetching /api/me to validate token');
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('AuthContext - /api/me Response:', response.data);

        if (!response.data || !response.data.user) {
          throw new Error('Invalid user data from /api/me');
        }

        setUser(response.data.user);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        console.log('User updated from /api/me:', response.data.user);
      } catch (error) {
        console.error('AuthContext - Error initializing auth:', error);
        console.error('Error details:', error.response?.data || error.message);
        // 토큰이 있고 API만 실패한 경우, 기존 로컬 데이터 유지
        if (localStorage.getItem('token') && localStorage.getItem('user')) {
          console.log('Keeping existing user data due to API failure');
        } else {
          setUser(null);
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          if (!['/login', '/register'].includes(window.location.pathname)) {
            console.log('No valid token/user, redirecting to login');
            window.location.href = '/login';
          }
        }
      } finally {
        setLoading(false);
        console.log('Auth initialization completed, loading:', false);
      }
    };
    initializeAuth();
  }, []);

  const logout = () => {
    console.log('Logging out user');
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};