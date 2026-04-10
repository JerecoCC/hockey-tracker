import { useLocation } from 'react-router-dom';
import styles from './PageHeader.module.scss';

const EXACT_TITLES: Record<string, string> = {
  '/admin/leagues': 'Leagues',
  '/admin/seasons': 'Seasons',
  '/admin/teams':   'Teams',
  '/admin/users':   'Users',
};

const getTitle = (pathname: string): string => {
  if (EXACT_TITLES[pathname]) return EXACT_TITLES[pathname];
  if (/\/admin\/leagues\/[^/]+\/teams\//.test(pathname)) return 'Team Details';
  if (/\/admin\/leagues\/[^/]+/.test(pathname)) return 'League Details';
  if (/\/admin\/teams\/[^/]+/.test(pathname)) return 'Team Details';
  return '';
};

const PageHeader = () => {
  const { pathname } = useLocation();
  const title = getTitle(pathname);
  if (!title) return null;

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
    </header>
  );
};

export default PageHeader;
