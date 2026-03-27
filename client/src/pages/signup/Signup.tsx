import { useState } from 'react';
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button/Button';
import GoogleButton from '../../components/GoogleButton/GoogleButton';
import Icon from '../../components/Icon/Icon';
import styles from './Signup.module.scss';

const SignupPage = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (form.password !== form.confirm) {
      toast.error('Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await signup({ name: form.name, email: form.email, password: form.password });
      navigate('/dashboard');
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e?.response?.data?.error || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}><Icon name="sports_hockey" size="1.1em" /> Hockey Tracker</h1>
        <h2 className={styles.subtitle}>Create an account</h2>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            Name
            <input
              className={styles.input}
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Wayne Gretzky"
              required
            />
          </label>

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
            <input
              className={styles.input}
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Min. 6 characters"
              required
            />
          </label>

          <label className={styles.label}>
            Confirm password
            <input
              className={styles.input}
              type="password"
              name="confirm"
              value={form.confirm}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
          </label>

          <Button className={styles.primaryBtn} type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <div className={styles.divider}>
          <span>or</span>
        </div>

        <GoogleButton label="Sign up with Google" />

        <p className={styles.footer}>
          Already have an account?{' '}
          <Link className={styles.link} to="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;

