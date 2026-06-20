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
  { label: 'Users', path: '/admin/users', icon: 'group' },
];

interface AdminNavProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const AdminNav = (props: AdminNavProps) => {
  const { collapsed, mobileOpen, onMobileClose } = props;
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  const showExpanded = !collapsed || !!mobileOpen;

  const handleNavClick = (path: string) => {
    navigate(path);
    onMobileClose?.();
  };

  return (
    <nav
      className={`${styles.nav} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''}`}
    >
      <div className={styles.top}>
        <div className={styles.brandRow}>
          {showExpanded && (
            <span className={styles.brand}>
              <Icon
                name="shield"
                className={styles.brandIcon}
              />{' '}
              Admin
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
                onClick={() => handleNavClick(path)}
                tooltip={!showExpanded ? label : undefined}
                tooltipClassName={!showExpanded ? styles.navTooltipWrapper : undefined}
              >
                <Icon
                  name={icon}
                  className={styles.icon}
                />
                {showExpanded && <span className={styles.label}>{label}</span>}
              </Button>
            </li>
          ))}
        </ul>
      </div>

    </nav>
  );
};

export default AdminNav;
