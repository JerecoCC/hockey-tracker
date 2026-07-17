import { useMemo, useState, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import BreadcrumbTitleRow from '@jerecocc/tracker-ui/components/Breadcrumbs/BreadcrumbTitleRow';
import Icon from '@jerecocc/tracker-ui/components/Icon/Icon';
import BreadcrumbContext, { type BreadcrumbConfig } from '@/context/BreadcrumbContext';
import MobileTabsContext, { type MobileTabsState } from '@/context/MobileTabsContext';
import QueryProvider from '@/context/QueryProvider';
import TitleRowContext from '@/context/TitleRowContext';
import PageHeader from '@/shared/PageHeader/PageHeader';
import styles from './AppLayout.module.scss';

export interface AppNavigationProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onToggle: () => void;
}

interface AppLayoutProps {
  renderNavigation: (props: AppNavigationProps) => ReactNode;
}

const AppLayout = ({ renderNavigation }: AppLayoutProps) => {
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  // State ref-callbacks trigger a render when portal targets become available.
  const [titleRowContainer, setTitleRowContainer] = useState<HTMLDivElement | null>(null);
  const [mobileTitleLeftContainer, setMobileTitleLeftContainer] = useState<HTMLDivElement | null>(
    null,
  );
  const [mobileTabs, setMobileTabs] = useState<MobileTabsState | null>(null);
  const [breadcrumbConfig, setBreadcrumbs] = useState<BreadcrumbConfig | null>(null);
  const mobileTabsContext = useMemo(() => ({ mobileTabs, setMobileTabs }), [mobileTabs]);
  const breadcrumbContext = useMemo(
    () => ({ config: breadcrumbConfig, setBreadcrumbs }),
    [breadcrumbConfig],
  );
  const titleRowContext = useMemo(
    () => ({ rowContainer: titleRowContainer, mobileLeftContainer: mobileTitleLeftContainer }),
    [titleRowContainer, mobileTitleLeftContainer],
  );
  const toggleSidebar = () => setCollapsed((value) => !value);
  const closeMobileNavigation = () => setMobileOpen(false);

  return (
    <QueryProvider>
      <BreadcrumbContext.Provider value={breadcrumbContext}>
        <MobileTabsContext.Provider value={mobileTabsContext}>
          <TitleRowContext.Provider value={titleRowContext}>
            <div className={styles.page}>
              {mobileOpen && (
                <div
                  className={styles.overlay}
                  onClick={closeMobileNavigation}
                  aria-hidden="true"
                />
              )}

              <div className={styles.sidebarWrapper}>
                {renderNavigation({
                  collapsed,
                  mobileOpen,
                  onMobileClose: closeMobileNavigation,
                  onToggle: toggleSidebar,
                })}
                <button
                  className={styles.sidebarToggle}
                  onClick={toggleSidebar}
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
                  onMenuToggle={() => setMobileOpen((value) => !value)}
                  mobileTitleLeftRef={setMobileTitleLeftContainer}
                />
                <main className={styles.main}>
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

export default AppLayout;
