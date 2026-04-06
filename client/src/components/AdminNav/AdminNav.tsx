import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../Button/Button';
import Icon from '../Icon/Icon';
import Tooltip from '../Tooltip/Tooltip';
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
          <Tooltip text={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <Button
              variant="ghost"
              intent="neutral"
              className={styles.toggleBtn}
              onClick={() => setCollapsed((c) => !c)}
              icon={collapsed ? 'chevron_right' : 'chevron_left'}
              iconSize="0.65rem"
            />
          </Tooltip>
        </div>

        <ul className={styles.list}>
          {NAV_ITEMS.map(({ label, path, icon }) => (
            <li key={path}>
              {collapsed ? (
                <Tooltip
                  text={label}
                  className={styles.navTooltipWrapper}
                >
                  <Button
                    variant="ghost"
                    intent="neutral"
                    className={`${styles.navItem} ${pathname === path ? styles.active : ''}`}
                    onClick={() => navigate(path)}
                  >
                    <Icon
                      name={icon}
                      className={styles.icon}
                    />
                  </Button>
                </Tooltip>
              ) : (
                <Button
                  variant="ghost"
                  intent="neutral"
                  className={`${styles.navItem} ${pathname === path ? styles.active : ''}`}
                  onClick={() => navigate(path)}
                >
                  <Icon
                    name={icon}
                    className={styles.icon}
                  />
                  <span className={styles.label}>{label}</span>
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.bottom}>
        {collapsed ? (
          <Tooltip
            text="Back to Dashboard"
            className={styles.navTooltipWrapper}
          >
            <Button
              variant="outlined"
              intent="neutral"
              icon="arrow_back"
              className={styles.backBtn}
              onClick={() => navigate('/dashboard')}
            />
          </Tooltip>
        ) : (
          <Button
            variant="outlined"
            intent="neutral"
            icon="arrow_back"
            className={styles.backBtn}
            onClick={() => navigate('/dashboard')}
          >
            Back to Dashboard
          </Button>
        )}
      </div>
    </nav>
  );
};

export default AdminNav;
