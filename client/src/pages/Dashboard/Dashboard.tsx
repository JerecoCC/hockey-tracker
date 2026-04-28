import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import Icon from '@/components/Icon/Icon';
import Card from '@/components/Card/Card';
import styles from '@/pages/dashboard/Dashboard.module.scss';

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={styles.page}>
      <Card
        variant="light"
        className={styles.dashboardCard}
      >
        <header className={styles.header}>
          <h1 className={styles.title}>
            <Icon
              name="sports_hockey"
              size="1.1em"
            />{' '}
            Hockey Tracker
          </h1>
          <Button
            variant="ghost"
            intent="neutral"
            className={styles.logoutBtn}
            onClick={handleLogout}
          >
            Sign out
          </Button>
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
          <Icon
            name="celebration"
            size="1.1em"
          />{' '}
          You&apos;re signed in. Start tracking your hockey stats here.
        </p>

        {user?.role === 'admin' && (
          <Button
            className={styles.adminBtn}
            icon="admin_panel_settings"
            iconSize="1.1em"
            onClick={() => navigate('/admin/leagues')}
            style={{ marginTop: '1.25rem', width: '100%' }}
          >
            Go to Admin Panel
          </Button>
        )}
      </Card>
    </div>
  );
};

export default DashboardPage;
