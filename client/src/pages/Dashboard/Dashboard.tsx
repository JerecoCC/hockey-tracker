import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon/Icon';
import styles from './Dashboard.module.scss';

const Dashboard = () => {
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
          <h1 className={styles.title}><Icon name="sports_hockey" size="1.1em" /> Hockey Tracker</h1>
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
          <Icon name="celebration" size="1.1em" /> You&apos;re signed in. Start tracking your hockey stats here.
        </p>

        {user?.role === 'admin' && (
          <button
            className={styles.adminBtn}
            onClick={() => navigate('/admin/users')}
            style={{ marginTop: '1.25rem', width: '100%' }}
          >
            <Icon name="admin_panel_settings" size="1.1em" /> Go to Admin Panel
          </button>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

