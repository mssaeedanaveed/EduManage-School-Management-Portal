import React, { createContext, useContext, useState, useEffect } from 'react';
import api, { setAccessToken } from '../api/axios.js';
import { IUser, UserRole } from '../types/index.js';

interface AuthContextType {
  user: IUser | null;
  profile: any;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  demoLogin: (role: UserRole) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<IUser | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentUser = async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await api.get('/api/auth/me');
      if (res.data?.success) {
        setUser(res.data.user);
        setProfile(res.data.profile);
      }
    } catch {
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    localStorage.removeItem('edumanage_token');
    localStorage.removeItem('edumanage_user');
    localStorage.removeItem('edumanage_profile');
    fetchCurrentUser();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.post('/api/auth/login', { email, password });
      if (res.data?.success) {
        setAccessToken(res.data.token);
        setToken(res.data.token);
        setUser(res.data.user);
        setProfile(res.data.profile);
        return { success: true };
      }
      return { success: false, message: res.data?.message || 'Login failed' };
    } catch (err: any) {
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Login failed. Please check credentials.',
      };
    } finally {
      setIsLoading(false);
    }
  };

  const demoLogin = async (role: UserRole) => {
    const roleEmails: Record<UserRole, string> = {
      admin: 'admin@school.edu',
      accountant: 'accountant@school.edu',
      teacher: 'teacher@school.edu',
      student: 'student@school.edu',
      parent: 'parent@school.edu',
    };
    await login(roleEmails[role], 'password123');
  };

  const logout = () => {
    setAccessToken(null);
    setToken(null);
    setUser(null);
    setProfile(null);
  };

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        token,
        isLoading,
        login,
        demoLogin,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
