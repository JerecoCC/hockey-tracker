/**
 * AuthCallback – Landing page after Google OAuth redirect.
 * The server sends the JWT as a ?token= query param.
 * We store it, fetch the user, then redirect to /dashboard.
 */
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // We need the setUser function exposed via context
  const { login: _login } = useAuth();

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      navigate('/login?error=no_token');
      return;
    }

    localStorage.setItem('token', token);

    // Fetch the user then hard-reload so AuthContext picks up the token
    axios
      .get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(() => navigate('/dashboard'))
      .catch(() => {
        localStorage.removeItem('token');
        navigate('/login?error=auth_failed');
      });
  }, [navigate, params, _login]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg,#0d1b2a 0%,#1b3a5c 100%)',
        color: '#fff',
        fontSize: 18,
      }}
    >
      Signing you in…
    </div>
  );
}

