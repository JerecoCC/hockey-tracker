import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import TitleRowContext from '@/context/TitleRowContext';
import Icon from '../Icon/Icon';
import PageHeader from '../PageHeader/PageHeader';
import UserNav from '../UserNav/UserNav';
import styles from './UserLayout.module.scss';

const UserLayout = () => {
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  // State ref-callback: triggers a re-render once the div mounts so the portal
  // target is available to all child TitleRow instances.
  const [titleRowContainer, setTitleRowContainer] = useState<HTMLDivElement | null>(null);

  return (
    <TitleRowContext.Provider value={titleRowContainer}>
      <div className={styles.page}>
        {/* Mobile backdrop */}
        {mobileOpen && (
          <div
            className={styles.overlay}
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}

        <div className={styles.sidebarWrapper}>
          <UserNav
            collapsed={collapsed}
            onToggle={() => setCollapsed((c) => !c)}
            mobileOpen={mobileOpen}
            onMobileClose={() => setMobileOpen(false)}
          />
          <button
            className={styles.sidebarToggle}
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon
              name={collapsed ? 'chevron_right' : 'chevron_left'}
              size="0.75rem"
            />
          </button>
        </div>
        <div className={styles.scrollArea}>
          <PageHeader onMenuToggle={() => setMobileOpen((o) => !o)} />
          <main className={styles.main}>
            {/* Portal target — TitleRow from any child page renders here */}
            <div ref={setTitleRowContainer} />
            <Outlet />
          </main>
        </div>
      </div>
    </TitleRowContext.Provider>
  );
};

export default UserLayout;
