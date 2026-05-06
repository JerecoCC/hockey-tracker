import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../Button/Button';
import Icon from '../Icon/Icon';
import styles from './UserNav.module.scss';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: 'apps' },
  { label: 'Games', path: '/games', icon: 'sports_hockey' },
];

interface UserNavProps {
  collapsed: boolean;
  onToggle: () => void;
}

const UserNav = (props: UserNavProps) => {
  const { collapsed } = props;
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  return (
    <nav className={`${styles.nav} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.top}>
        <div className={styles.brandRow}>
          {!collapsed && (
            <span className={styles.brand}>
              <Icon
                name="sports_hockey"
                className={styles.brandIcon}
              />{' '}
              Hockey
            </span>
          )}
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
    </nav>
  );
};

export default UserNav;
