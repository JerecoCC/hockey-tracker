import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import TitleRowContext from '@/context/TitleRowContext';
import AdminNav from '@/components/AdminNav/AdminNav';
import Icon from '@/components/Icon/Icon';
import PageHeader from '@/components/PageHeader/PageHeader';
import styles from '@/components/AdminLayout/AdminLayout.module.scss';

const AdminLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  // State ref-callback: triggers a re-render once the div mounts so the portal
  // target is available to all child TitleRow instances.
  const [titleRowContainer, setTitleRowContainer] = useState<HTMLDivElement | null>(null);

  return (
    <TitleRowContext.Provider value={titleRowContainer}>
      <div className={styles.page}>
        <div className={styles.sidebarWrapper}>
          <AdminNav
            collapsed={collapsed}
            onToggle={() => setCollapsed((c) => !c)}
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
          <PageHeader />
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

export default AdminLayout;
