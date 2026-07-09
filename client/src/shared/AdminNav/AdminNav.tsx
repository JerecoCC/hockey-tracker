import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '@/context/ThemeContext';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import Icon from '@jerecocc/tracker-ui/components/Icon/Icon';
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
  const { isDarkMode, toggleTheme } = useTheme();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  const showExpanded = !collapsed || !!mobileOpen;
  const themeTooltip = isDarkMode ? 'Switch to light mode' : 'Switch to dark mode';

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

      <div className={styles.bottom}>
        <Button
          variant="ghost"
          intent="neutral"
          className={`${styles.navItem} ${styles.themeToggle}`}
          onClick={toggleTheme}
          role="switch"
          aria-checked={isDarkMode}
          aria-label={themeTooltip}
          tooltip={!showExpanded ? themeTooltip : undefined}
          tooltipClassName={!showExpanded ? styles.navTooltipWrapper : undefined}
        >
          <Icon
            name={isDarkMode ? 'dark_mode' : 'light_mode'}
            className={styles.icon}
          />
          {showExpanded && (
            <>
              <span className={styles.label}>Dark mode</span>
              <span
                className={`${styles.themeSwitch} ${isDarkMode ? styles.themeSwitchOn : ''}`}
                aria-hidden="true"
              >
                <span className={styles.themeSwitchThumb} />
              </span>
            </>
          )}
        </Button>
      </div>
    </nav>
  );
};

export default AdminNav;
