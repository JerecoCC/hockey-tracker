import AdminNav from '../../../components/AdminNav/AdminNav';
import Icon from '../../../components/Icon/Icon';
import styles from './Leagues.module.scss';

const Leagues = () => (
  <div className={styles.page}>
    <AdminNav />
    <main className={styles.main}>
      <h1 className={styles.sectionTitle}>
        <Icon name="emoji_events" size="1em" /> Leagues
      </h1>

      <div className={styles.card}>
        <p className={styles.emptyMsg}>
          <Icon name="construction" size="1.1em" /> Leagues are coming soon. Check back later!
        </p>
      </div>
    </main>
  </div>
);

export default Leagues;

