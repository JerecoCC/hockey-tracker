import { useState, useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import BreadcrumbContext, { type BreadcrumbConfig } from '@/context/BreadcrumbContext';
import TitleRowContext from '@/context/TitleRowContext';
import MobileTabsContext, { type MobileTabsState } from '@/context/MobileTabsContext';
import QueryProvider from '@/context/QueryProvider';
import BreadcrumbTitleRow from '@jerecocc/tracker-ui/BreadcrumbTitleRow';
import AdminNav from '@/shared/AdminNav/AdminNav';
import Icon from '@jerecocc/tracker-ui/Icon';
import PageHeader from '@/shared/PageHeader/PageHeader';
import styles from './AdminLayout.module.scss';

const AdminLayout = () => {
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  // State ref-callbacks: trigger a re-render once the div mounts so portal
  // targets are available to all child instances.
  const [titleRowContainer, setTitleRowContainer] = useState<HTMLDivElement | null>(null);
  const [mobileTitleLeftContainer, setMobileTitleLeftContainer] = useState<HTMLDivElement | null>(
    null,
  );
  const [mobileTabs, setMobileTabs] = useState<MobileTabsState | null>(null);
  const [breadcrumbConfig, setBreadcrumbs] = useState<BreadcrumbConfig | null>(null);
  const mobileTabsCtx = useMemo(() => ({ mobileTabs, setMobileTabs }), [mobileTabs]);
  const breadcrumbCtx = useMemo(
    () => ({ config: breadcrumbConfig, setBreadcrumbs }),
    [breadcrumbConfig],
  );
  const titleRowCtx = useMemo(
    () => ({ rowContainer: titleRowContainer, mobileLeftContainer: mobileTitleLeftContainer }),
    [titleRowContainer, mobileTitleLeftContainer],
  );

  return (
    <QueryProvider>
      <BreadcrumbContext.Provider value={breadcrumbCtx}>
        <MobileTabsContext.Provider value={mobileTabsCtx}>
          <TitleRowContext.Provider value={titleRowCtx}>
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
                <AdminNav
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
              <div
                className={styles.scrollArea}
                data-app-scroll-lock-target="true"
              >
                <PageHeader
                  onMenuToggle={() => setMobileOpen((o) => !o)}
                  mobileTitleLeftRef={setMobileTitleLeftContainer}
                />
                <main className={styles.main}>
                  {/* Portal target - TitleRow from any child page renders here */}
                  <div ref={setTitleRowContainer} />
                  <BreadcrumbTitleRow />
                  <Outlet />
                </main>
              </div>
            </div>
          </TitleRowContext.Provider>
        </MobileTabsContext.Provider>
      </BreadcrumbContext.Provider>
    </QueryProvider>
  );
};

export default AdminLayout;
