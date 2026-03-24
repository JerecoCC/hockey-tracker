import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || '/api';

export interface User {
  id: string;
  display_name: string;
  displayName?: string;
  email: string;
  role: 'admin' | 'user';
  photo?: string;
  is_google?: boolean;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface SignupCredentials {
  name: string;
  email: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<User>;
  signup: (credentials: SignupCredentials) => Promise<User>;
  loginWithGoogle: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch current user on mount if a token exists
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    axios
      .get<User>(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async ({ email, password }: LoginCredentials): Promise<User> => {
    const { data } = await axios.post<{ token: string; user: User }>(`${API}/auth/login`, { email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const signup = useCallback(async ({ name, email, password }: SignupCredentials): Promise<User> => {
    const { data } = await axios.post<{ token: string; user: User }>(`${API}/auth/signup`, { name, email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const loginWithGoogle = useCallback(() => {
    window.location.href = `${API}/auth/google`;
  }, []);

  const logout = useCallback(async () => {
    const token = localStorage.getItem('token');
    await axios
      .post(`${API}/auth/logout`, {}, { headers: { Authorization: `Bearer ${token}` } })
      .catch(() => {});
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

