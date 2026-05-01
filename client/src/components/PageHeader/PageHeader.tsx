import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Icon from '../Icon/Icon';
import Tooltip from '../Tooltip/Tooltip';
import styles from './PageHeader.module.scss';

const EXACT_TITLES: Record<string, string> = {
  '/admin/leagues': 'Leagues',
  '/admin/users': 'Users',
  '/dashboard': 'Dashboard',
  '/leagues': 'Leagues',
};

const getTitle = (pathname: string): string => {
  if (EXACT_TITLES[pathname]) return EXACT_TITLES[pathname];
  if (/\/admin\/leagues\/[^/]+\/teams\//.test(pathname)) return 'Team Details';
  if (/\/admin\/leagues\/[^/]+\/seasons\/[^/]+\/games\//.test(pathname)) return 'Game Details';
  if (/\/admin\/leagues\/[^/]+\/seasons\//.test(pathname)) return 'Season Details';
  if (/\/admin\/leagues\/[^/]+/.test(pathname)) return 'League Details';
  if (/\/admin\/teams\/[^/]+/.test(pathname)) return 'Team Details';
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

const PageHeader = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const title = getTitle(pathname);
  const isAdmin = user?.role === 'admin';
  const isAdminPanel = pathname.startsWith('/admin');

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

  const handleSwitchPanel = () => {
    if (isAdminPanel) navigate('/leagues');
    else navigate('/admin/leagues');
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>{title && <h1 className={styles.title}>{title}</h1>}</div>

      <div className={styles.right}>
        {user && (
          <div
            className={styles.profileChip}
            ref={dropdownRef}
          >
            {isAdmin && (
              <Tooltip text={isAdminPanel ? 'User View' : 'Admin Panel'}>
                <button
                  className={styles.switchBtn}
                  onClick={handleSwitchPanel}
                >
                  <Icon
                    name={isAdminPanel ? 'apps' : 'shield'}
                    size="1.1rem"
                  />
                </button>
              </Tooltip>
            )}
            <button
              className={styles.profileBtn}
              onClick={() => setDropdownOpen((o) => !o)}
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
              <span className={styles.displayName}>{user.display_name ?? user.displayName}</span>
              <Icon
                name="expand_more"
                size="1rem"
                className={dropdownOpen ? styles.chevronOpen : styles.chevron}
              />
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
    </header>
  );
};

export default PageHeader;
