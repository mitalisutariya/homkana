import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('userInfo');
    return saved ? JSON.parse(saved) : null;
  });

  const isLoggedIn = !!user;

  const persistUser = (data) => {
    setUser(data);
    localStorage.setItem('userInfo', JSON.stringify(data));
    return data;
  };

  const login = async (email, password) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      return persistUser(data);
    } catch (error) {
      throw error.response?.data?.message || error.message;
    }
  };

  const registerUser = async (name, email, password) => {
    try {
      const { data } = await api.post('/auth/register', { name, email, password });
      return persistUser(data);
    } catch (error) {
      throw error.response?.data?.message || error.message;
    }
  };

  const loginWithGoogle = async (credential) => {
    try {
      const { data } = await api.post('/auth/google', { credential });
      return persistUser(data);
    } catch (error) {
      throw error.response?.data?.message || error.message;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('userInfo');
  };

  const refreshUser = async () => {
    const saved = localStorage.getItem('userInfo');
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved);
      if (!parsed.token) return null;
      const { data } = await api.get('/auth/me');
      const updated = { ...parsed, ...data, token: parsed.token };
      setUser(updated);
      localStorage.setItem('userInfo', JSON.stringify(updated));
      return updated;
    } catch (error) {
      console.error('Failed to refresh user', error);
      return null;
    }
  };

  const updateUserCart = (cart) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, cart: cart || [] };
      localStorage.setItem('userInfo', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    const saved = localStorage.getItem('userInfo');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed.token) refreshUser();
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn,
        login,
        registerUser,
        loginWithGoogle,
        logout,
        refreshUser,
        updateUserCart,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
