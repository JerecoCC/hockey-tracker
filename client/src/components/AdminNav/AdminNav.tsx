import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../Button/Button';
import Icon from '../Icon/Icon';
import styles from './AdminNav.module.scss';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Teams', path: '/admin/teams', icon: 'groups' },
  { label: 'Leagues', path: '/admin/leagues', icon: 'emoji_events' },
  { label: 'Users', path: '/admin/users', icon: 'group' },
];

const AdminNav = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <nav className={`${styles.nav} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.top}>
        <div className={styles.brandRow}>
          {!collapsed && (
            <span className={styles.brand}>
              <Icon name="shield" className={styles.brandIcon} /> Admin
            </span>
          )}
          <button
            className={styles.toggleBtn}
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon name={collapsed ? 'chevron_right' : 'chevron_left'} size="0.65rem" />
          </button>
        </div>

        <ul className={styles.list}>
          {NAV_ITEMS.map(({ label, path, icon }) => (
            <li key={path}>
              <button
                className={`${styles.navItem} ${pathname === path ? styles.active : ''}`}
                onClick={() => navigate(path)}
                title={collapsed ? label : undefined}
              >
                <Icon name={icon} className={styles.icon} />
                {!collapsed && <span className={styles.label}>{label}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.bottom}>
        <Button
          variant="outlined"
          intent="neutral"
          icon="arrow_back"
          className={styles.backBtn}
          onClick={() => navigate('/dashboard')}
          title={collapsed ? 'Back to Dashboard' : undefined}
        >
          {!collapsed && 'Back to Dashboard'}
        </Button>
      </div>
    </nav>
  );
};

export default AdminNav;

