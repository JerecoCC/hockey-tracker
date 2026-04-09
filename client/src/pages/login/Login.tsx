import { useState } from 'react';
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button/Button';
import GoogleButton from '../../components/GoogleButton/GoogleButton';
import Icon from '../../components/Icon/Icon';
import Card from '../../components/Card/Card';
import styles from './Login.module.scss';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form);
      navigate('/dashboard');
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e?.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <Card
        variant="light"
        className={styles.authCard}
      >
        <h1 className={styles.title}>
          <Icon
            name="sports_hockey"
            size="1.1em"
          />{' '}
          Hockey Tracker
        </h1>
        <h2 className={styles.subtitle}>Sign in to your account</h2>

        <form
          onSubmit={handleSubmit}
          className={styles.form}
        >
          <label className={styles.label}>
            Email
            <input
              className={styles.input}
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
            />
          </label>

          <label className={styles.label}>
            Password
            <div className={styles.inputWrapper}>
              <input
                className={styles.input}
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <Icon name={showPassword ? 'visibility_off' : 'visibility'} />
              </button>
            </div>
          </label>

          <Button
            className={styles.primaryBtn}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className={styles.divider}>
          <span>or</span>
        </div>

        <GoogleButton label="Sign in with Google" />

        <p className={styles.footer}>
          Don&apos;t have an account?{' '}
          <Link
            className={styles.link}
            to="/signup"
          >
            Sign up
          </Link>
        </p>
      </Card>
    </div>
  );
};

export default LoginPage;
