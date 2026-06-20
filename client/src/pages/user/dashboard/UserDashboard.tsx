import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/Button/Button';
import ScoreImageModal from '@/pages/admin/games/game-details/ScoreImageModal';
import styles from './UserDashboard.module.scss';

const UserDashboard = () => {
  const { user } = useAuth();
  const [scoreImageOpen, setScoreImageOpen] = useState(false);

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

      <Button
        icon="image"
        iconSize="1.1em"
        onClick={() => setScoreImageOpen(true)}
      >
        Generate Score Image
      </Button>

      <ScoreImageModal
        open={scoreImageOpen}
        onClose={() => setScoreImageOpen(false)}
        showForm
      />
    </div>
  );
};

export default UserDashboard;
