import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useMobileTabs } from '@/context/MobileTabsContext';
import Icon from '../Icon/Icon';
import styles from './PageHeader.module.scss';

const EXACT_TITLES: Record<string, string> = {
  '/admin/leagues': 'Leagues',
  '/admin/users': 'Users',
  '/dashboard': 'Dashboard',
  '/games': 'Games',
};

const getTitle = (pathname: string): string => {
  if (EXACT_TITLES[pathname]) return EXACT_TITLES[pathname];
  if (/\/admin\/leagues\/[^/]+\/teams\/[^/]+\/players\/[^/]+/.test(pathname))
    return 'Player Details';
  if (/\/admin\/leagues\/[^/]+\/teams\//.test(pathname)) return 'Team Details';
  if (/\/admin\/leagues\/[^/]+\/seasons\/[^/]+\/games\//.test(pathname)) return 'Game Details';
  if (/\/admin\/leagues\/[^/]+\/seasons\//.test(pathname)) return 'Season Details';
  if (/\/admin\/leagues\/[^/]+/.test(pathname)) return 'League Details';
  if (/\/admin\/teams\/[^/]+/.test(pathname)) return 'Team Details';
  if (/\/games\/[^/]+/.test(pathname)) return 'Game Details';
  if (/\/leagues\/[^/]+/.test(pathname)) return 'League Details';
  return '';
};

const getInitials = (name: string | undefined) =>
  (name ?? '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

interface PageHeaderProps {
  onMenuToggle?: () => void;
}

const PageHeader = ({ onMenuToggle }: PageHeaderProps) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { mobileTabs } = useMobileTabs();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const routeTitle = getTitle(pathname);
  // On mobile, swap the route title for the active tab name when tabs are present.
  const activeTabLabel = mobileTabs?.tabs[mobileTabs.activeIndex];
  const title = routeTitle;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className={styles.header}>
      {/* ── Main title row ── */}
      <div className={styles.titleRow}>
        <div className={styles.left}>
          {onMenuToggle && (
            <button
              className={styles.hamburger}
              onClick={onMenuToggle}
              aria-label="Open navigation"
            >
              <Icon
                name="menu"
                size="1.4rem"
              />
            </button>
          )}
          {/* Route title – hidden on mobile when tabs are present */}
          {title && (
            <h1
              className={[styles.title, mobileTabs ? styles.titleHiddenMobile : '']
                .filter(Boolean)
                .join(' ')}
            >
              {title}
            </h1>
          )}
          {/* Active tab label – only shown on mobile when tabs are present */}
          {activeTabLabel && <h1 className={styles.titleMobileTab}>{activeTabLabel}</h1>}
        </div>

        <div className={styles.right}>
          {user && (
            <div
              className={styles.profileChip}
              ref={dropdownRef}
            >
              <button
                className={styles.profileBtn}
                onClick={() => setDropdownOpen((o) => !o)}
                aria-label="Account menu"
              >
                {user.photo ? (
                  <img
                    src={user.photo}
                    alt={user.display_name ?? user.displayName}
                    className={styles.avatar}
                  />
                ) : (
                  <span className={styles.avatarInitials}>
                    {getInitials(user.display_name ?? user.displayName)}
                  </span>
                )}
              </button>

              {dropdownOpen && (
                <div className={styles.dropdown}>
                  <button
                    className={styles.dropdownItem}
                    onClick={handleSignOut}
                  >
                    <Icon
                      name="logout"
                      size="1rem"
                    />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile tab strip (below title row) ── */}
      {mobileTabs && (
        <div className={styles.mobileTabBar}>
          {mobileTabs.tabs.map((label, i) => (
            <button
              key={label}
              className={[
                styles.mobileTab,
                mobileTabs.activeIndex === i ? styles.mobileTabActive : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => mobileTabs.onChange(i)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
};

export default PageHeader;
