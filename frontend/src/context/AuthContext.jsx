import React, { createContext, useContext, useState, useCallback } from 'react';
import { Api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('lf_user');
    return raw ? JSON.parse(raw) : null;
  });

  const login = useCallback(async (email, password) => {
    const { token, user: u } = await Api.login({ email, password });
    localStorage.setItem('lf_token', token);
    localStorage.setItem('lf_user', JSON.stringify(u));
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (data) => {
    const { token, user: u } = await Api.register(data);
    localStorage.setItem('lf_token', token);
    localStorage.setItem('lf_user', JSON.stringify(u));
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('lf_token');
    localStorage.removeItem('lf_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
