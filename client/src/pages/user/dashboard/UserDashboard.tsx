import { useAuth } from '@/context/AuthContext';
import styles from './UserDashboard.module.scss';

const UserDashboard = () => {
  const { user } = useAuth();

  return (
    <div className={styles.page}>
      <div className={styles.welcome}>
        {user?.photo && (
          <img
            src={user.photo}
            alt=""
            className={styles.avatar}
            referrerPolicy="no-referrer"
          />
        )}
        <div>
          <h2 className={styles.welcomeName}>
            Welcome, {user?.display_name ?? user?.displayName ?? 'Player'}!
          </h2>
          <p className={styles.welcomeEmail}>{user?.email}</p>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
