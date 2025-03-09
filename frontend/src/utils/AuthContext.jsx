import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
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
        if (storedUser && token) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          console.log('AuthContext - Fetching /api/me');
          const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          console.log('AuthContext - Response:', response.data);
          if (!response.data || !response.data.user) {
            throw new Error('Invalid user data');
          }
          setUser(response.data.user);
          localStorage.setItem('user', JSON.stringify(response.data.user));
        } else if (!['/login', '/register'].includes(window.location.pathname)) {
          console.log('AuthContext - No token/user, redirecting to login');
          setUser(null);
          window.location.href = '/login';
        }
      } catch (error) {
        console.error('AuthContext - Error initializing auth:', error);
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        if (!['/login', '/register'].includes(window.location.pathname)) {
          window.location.href = '/login';
        }
      } finally {
        setLoading(false);
      }
    };
    initializeAuth();
  }, []); // 의존성 배열 유지, 로그인 후 setUser로 동기화

  const logout = () => {
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