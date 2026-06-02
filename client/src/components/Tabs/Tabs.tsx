import { useState, useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useMobileTabs } from '@/context/MobileTabsContext';
import styles from './Tabs.module.scss';

export interface Tab {
  label: string;
  /** Optional icon name (from Icon component) shown in the mobile header tab strip. */
  icon?: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  /** Controlled active index. */
  activeIndex?: number;
  /** Initial tab index when uncontrolled (defaults to 0). */
  defaultIndex?: number;
  onTabChange?: (index: number) => void;
  className?: string;
  /** When true, all tab buttons are dimmed and non-interactive. */
  disabled?: boolean;
}

const Tabs = (props: TabsProps) => {
  const { tabs, activeIndex, defaultIndex = 0, onTabChange, className, disabled = false } = props;
  const [internal, setInternal] = useState(defaultIndex);
  const requestedActive = activeIndex ?? internal;
  const active = Math.min(Math.max(requestedActive, 0), Math.max(tabs.length - 1, 0));
  const { setMobileTabs } = useMobileTabs();

  // Keep a ref to the latest onTabChange so the context callback never goes stale.
  const onTabChangeRef = useRef(onTabChange);
  onTabChangeRef.current = onTabChange;

  const handleSelect = (i: number) => {
    setInternal(i);
    onTabChange?.(i);
  };

  // Register with MobileTabsContext so PageHeader can render the tab strip.
  // useLayoutEffect fires synchronously before paint → no flash on first render.
  useLayoutEffect(() => {
    setMobileTabs({
      tabs: tabs.map((t) => t.label),
      icons: tabs.map((t) => t.icon),
      activeIndex: active,
      onChange: (i) => {
        setInternal(i);
        onTabChangeRef.current?.(i);
      },
    });
    return () => {
      // Clear when this Tabs instance unmounts (navigating away).
      setMobileTabs(null);
    };
    // Re-register whenever the active tab or the tab count changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tabs.length]);

  return (
    <div className={[styles.tabs, className].filter(Boolean).join(' ')}>
      <div
        className={[
          styles.tabList,
          disabled ? styles.tabListDisabled : '',
          styles.tabListHiddenMobile,
        ]
          .filter(Boolean)
          .join(' ')}
        role="tablist"
      >
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            role="tab"
            aria-selected={active === i}
            className={`${styles.tab} ${active === i ? styles.tabActive : ''}`}
            onClick={() => handleSelect(i)}
            disabled={disabled}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.tabPanel}>{tabs[active]?.content}</div>
    </div>
  );
};

export default Tabs;
