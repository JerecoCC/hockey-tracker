import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <header className={styles.header}>
          <h1 className={styles.title}>🏒 Hockey Tracker</h1>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Sign out
          </button>
        </header>

        <div className={styles.welcome}>
          {user?.photo && (
            <img
              src={user.photo}
              alt="avatar"
              className={styles.avatar}
              referrerPolicy="no-referrer"
            />
          )}
          <div>
            <h2 className={styles.name}>Welcome, {user?.displayName || 'Player'}!</h2>
            <p className={styles.email}>{user?.email}</p>
          </div>
        </div>

        <p className={styles.placeholder}>
          🎉 You&apos;re signed in. Start tracking your hockey stats here.
        </p>

        {user?.role === 'admin' && (
          <button
            className={styles.adminBtn}
            onClick={() => navigate('/admin')}
            style={{ marginTop: '1.25rem', width: '100%' }}
          >
            🛡️ Go to Admin Panel
          </button>
        )}
      </div>
    </div>
  );
}

