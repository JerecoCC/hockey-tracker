import { useState, useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import BreadcrumbContext, { type BreadcrumbConfig } from '@/context/BreadcrumbContext';
import TitleRowContext from '@/context/TitleRowContext';
import ScoreboardPortalContext from '@/context/ScoreboardPortalContext';
import MobileTabsContext, { type MobileTabsState } from '@/context/MobileTabsContext';
import BreadcrumbTitleRow from '../Breadcrumbs/BreadcrumbTitleRow';
import Icon from '../Icon/Icon';
import PageHeader from '../PageHeader/PageHeader';
import UserNav from '../UserNav/UserNav';
import styles from './UserLayout.module.scss';

const UserLayout = () => {
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  // State ref-callbacks: trigger a re-render once the div mounts so the portal
  // target is available to all child instances.
  const [titleRowContainer, setTitleRowContainer] = useState<HTMLDivElement | null>(null);
  const [mobileTitleLeftContainer, setMobileTitleLeftContainer] = useState<HTMLDivElement | null>(
    null,
  );
  const [scoreboardContainer, setScoreboardContainer] = useState<HTMLDivElement | null>(null);
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
    <BreadcrumbContext.Provider value={breadcrumbCtx}>
      <MobileTabsContext.Provider value={mobileTabsCtx}>
      <ScoreboardPortalContext.Provider value={scoreboardContainer}>
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
            <div
              className={styles.scrollArea}
              data-app-scroll-lock-target="true"
            >
              <PageHeader
                onMenuToggle={() => setMobileOpen((o) => !o)}
                mobileTitleLeftRef={setMobileTitleLeftContainer}
              />
              {/* Scoreboard portal slot — ScoreboardCard from game pages portals here.
                Sits outside <main> so it is never constrained by main's max-width/padding.
                The slot div itself is sticky so the card inherits that behaviour. */}
              <div
                ref={setScoreboardContainer}
                className={styles.scoreboardSlot}
              />
              <main className={styles.main}>
                {/* Portal target — TitleRow from any child page renders here */}
                <div ref={setTitleRowContainer} />
                <BreadcrumbTitleRow />
                <Outlet />
              </main>
            </div>
          </div>
        </TitleRowContext.Provider>
      </ScoreboardPortalContext.Provider>
      </MobileTabsContext.Provider>
    </BreadcrumbContext.Provider>
  );
};

export default UserLayout;
