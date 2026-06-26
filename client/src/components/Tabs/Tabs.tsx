import { useState, useLayoutEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
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
  /** When true, inactive tab panels stay mounted and are only hidden. */
  keepMounted?: boolean;
}

const Tabs = (props: TabsProps) => {
  const {
    tabs,
    activeIndex,
    defaultIndex = 0,
    onTabChange,
    className,
    disabled = false,
    keepMounted = false,
  } = props;
  const [internal, setInternal] = useState(defaultIndex);
  const requestedActive = activeIndex ?? internal;
  const active = Math.min(Math.max(requestedActive, 0), Math.max(tabs.length - 1, 0));
  const { setMobileTabs } = useMobileTabs();

  // Sliding accent indicator that moves to sit behind the active tab.
  const listRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<CSSProperties>();

  useLayoutEffect(() => {
    const measure = () => {
      const list = listRef.current;
      if (!list) return;
      const btn = list.querySelectorAll<HTMLElement>('[role="tab"]')[active];
      // Skip while hidden (e.g. mobile, where the strip is rendered elsewhere).
      if (!btn || btn.offsetWidth === 0) return;
      setIndicatorStyle({
        left: btn.offsetLeft,
        top: btn.offsetTop,
        width: btn.offsetWidth,
        height: btn.offsetHeight,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [active, tabs.length]);

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
        ref={listRef}
        className={[
          styles.tabList,
          disabled ? styles.tabListDisabled : '',
          styles.tabListHiddenMobile,
        ]
          .filter(Boolean)
          .join(' ')}
        role="tablist"
      >
        {indicatorStyle && (
          <span
            className={styles.tabIndicator}
            style={indicatorStyle}
            aria-hidden="true"
          />
        )}
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

      {keepMounted ? (
        tabs.map((tab, i) => (
          <div
            key={tab.label}
            className={styles.tabPanel}
            role="tabpanel"
            hidden={active !== i}
          >
            {tab.content}
          </div>
        ))
      ) : (
        <div
          className={styles.tabPanel}
          role="tabpanel"
        >
          {tabs[active]?.content}
        </div>
      )}
    </div>
  );
};

export default Tabs;
