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
  { label: 'Leagues', path: '/admin/leagues', icon: 'emoji_events' },
  { label: 'Seasons', path: '/admin/seasons', icon: 'calendar_month' },
  { label: 'Teams', path: '/admin/teams', icon: 'groups' },
  { label: 'Users', path: '/admin/users', icon: 'group' },
];

const AdminNav = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  return (
    <nav className={`${styles.nav} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.top}>
        <div className={styles.brandRow}>
          {!collapsed && (
            <span className={styles.brand}>
              <Icon
                name="shield"
                className={styles.brandIcon}
              />{' '}
              Admin
            </span>
          )}
          <Button
            variant="ghost"
            intent="neutral"
            className={styles.toggleBtn}
            onClick={() => setCollapsed((c) => !c)}
            icon={collapsed ? 'chevron_right' : 'chevron_left'}
            iconSize="0.65rem"
            tooltip={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          />
        </div>

        <ul className={styles.list}>
          {NAV_ITEMS.map(({ label, path, icon }) => (
            <li key={path}>
              <Button
                variant="ghost"
                intent="neutral"
                className={`${styles.navItem} ${isActive(path) ? styles.active : ''}`}
                onClick={() => navigate(path)}
                tooltip={collapsed ? label : undefined}
                tooltipClassName={collapsed ? styles.navTooltipWrapper : undefined}
              >
                <Icon
                  name={icon}
                  className={styles.icon}
                />
                {!collapsed && <span className={styles.label}>{label}</span>}
              </Button>
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
          tooltip={collapsed ? 'Back to Dashboard' : undefined}
          tooltipClassName={collapsed ? styles.navTooltipWrapper : undefined}
        >
          {!collapsed && 'Back to Dashboard'}
        </Button>
      </div>
    </nav>
  );
};

export default AdminNav;
