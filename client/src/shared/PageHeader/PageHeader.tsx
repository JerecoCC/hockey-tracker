import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useMobileTabs } from '@/context/MobileTabsContext';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import Icon from '@jerecocc/tracker-ui/components/Icon/Icon';
import styles from './PageHeader.module.scss';

const EXACT_TITLES: Record<string, string> = {
  '/admin/leagues': 'Leagues',
  '/admin/users': 'Users',
  '/dashboard': 'Dashboard',
  '/dashboard/games-watched': 'Games Watched',
  '/games': 'Games',
  '/games/watched': 'Games Watched',
  '/settings': 'Settings',
};

const getTitle = (pathname: string): string => {
  if (EXACT_TITLES[pathname]) return EXACT_TITLES[pathname];
  if (/\/admin\/leagues\/[^/]+\/teams\/[^/]+\/players\/[^/]+/.test(pathname))
    return 'Player Details';
  if (/\/admin\/leagues\/[^/]+\/players\/[^/]+/.test(pathname)) return 'Player Details';
  if (/\/admin\/leagues\/[^/]+\/teams\//.test(pathname)) return 'Team Details';
  if (/\/admin\/leagues\/[^/]+\/seasons\/[^/]+\/playoffs\//.test(pathname)) return 'Series Details';
  if (/\/admin\/leagues\/[^/]+\/seasons\/[^/]+\/days\/[^/]+$/.test(pathname))
    return 'Season Games';
  if (
    /\/admin\/leagues\/[^/]+\/seasons\/[^/]+\/games\/(?:\d{2}-\d{2}-\d{4}|\d{4}-\d{2}-\d{2})$/.test(
      pathname,
    )
  )
    return 'Season Games';
  if (/\/admin\/leagues\/[^/]+\/seasons\/[^/]+\/games\//.test(pathname)) return 'Game Details';
  if (/\/admin\/leagues\/[^/]+\/seasons\//.test(pathname)) return 'Season Details';
  if (/\/admin\/leagues\/[^/]+/.test(pathname)) return 'League Details';
  if (/\/admin\/teams\/[^/]+/.test(pathname)) return 'Team Details';
  if (/\/dashboard\/games-watched\/[^/]+/.test(pathname)) return 'Games Watched';
  if (/\/games\/[^/]+/.test(pathname)) return 'Game Details';
  if (/\/leagues\/[^/]+\/teams\/[^/]+\/players\/[^/]+/.test(pathname)) return 'Player Details';
  if (/\/leagues\/[^/]+\/players\/[^/]+/.test(pathname)) return 'Player Details';
  if (/\/leagues\/[^/]+\/teams\/[^/]+/.test(pathname)) return 'Team Details';
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
  mobileTitleLeftRef?: (node: HTMLDivElement | null) => void;
}

const PageHeader = ({ onMenuToggle, mobileTitleLeftRef }: PageHeaderProps) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { mobileTabs } = useMobileTabs();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const routeTitle = getTitle(pathname);
  // On mobile, swap the route title for "{RoutePrefix} {ActiveTab}", e.g. "Season Info".
  const activeTabLabel = mobileTabs?.tabs[mobileTabs.activeIndex];
  const routePrefix = routeTitle.split(' ')[0]; // "League Details" → "League"
  const mobileTabTitle = activeTabLabel ? `${routePrefix} ${activeTabLabel}` : null;
  const title = routeTitle;
  const showAdminPanelButton = user?.role === 'admin' && !pathname.startsWith('/admin');
  const showUserViewButton = user?.role === 'admin' && pathname.startsWith('/admin');

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
          <div
            ref={mobileTitleLeftRef}
            className={styles.mobileTitleLeft}
          />
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
          {/* Prefixed tab title – only shown on mobile when tabs are present */}
          {mobileTabTitle && <h1 className={styles.titleMobileTab}>{mobileTabTitle}</h1>}
        </div>

        <div className={styles.right}>
          {showUserViewButton && (
            <Button
              variant="ghost"
              intent="neutral"
              icon="apps"
              iconHeight="button"
              className={styles.adminPanelButton}
              aria-label="User View"
              tooltip="User View"
              onClick={() => navigate('/dashboard')}
            />
          )}
          {showAdminPanelButton && (
            <Button
              variant="ghost"
              intent="neutral"
              icon="shield"
              iconHeight="button"
              className={styles.adminPanelButton}
              aria-label="Admin Panel"
              tooltip="Admin Panel"
              onClick={() => navigate('/admin/leagues')}
            />
          )}
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
        </div>
      </div>

      {/* ── Mobile tab strip (below title row) ── */}
      {mobileTabs && (
        <div className={styles.mobileTabBar}>
          {mobileTabs.tabs.map((label, i) => {
            const iconName = mobileTabs.icons[i];
            return (
              <button
                key={label}
                aria-label={label}
                className={[
                  styles.mobileTab,
                  mobileTabs.activeIndex === i ? styles.mobileTabActive : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => mobileTabs.onChange(i)}
              >
                {iconName ? (
                  <Icon
                    name={iconName}
                    size="1.1rem"
                  />
                ) : (
                  label
                )}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};

export default PageHeader;
