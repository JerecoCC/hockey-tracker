import { useState } from 'react';
import type { ReactNode } from 'react';
import styles from './Tabs.module.scss';

export interface Tab {
  label: string;
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
}

const Tabs = ({ tabs, activeIndex, defaultIndex = 0, onTabChange, className }: TabsProps) => {
  const [internal, setInternal] = useState(defaultIndex);
  const active = activeIndex ?? internal;

  const handleSelect = (i: number) => {
    setInternal(i);
    onTabChange?.(i);
  };

  return (
    <div className={[styles.tabs, className].filter(Boolean).join(' ')}>
      <div
        className={styles.tabList}
        role="tablist"
      >
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            role="tab"
            aria-selected={active === i}
            className={`${styles.tab} ${active === i ? styles.tabActive : ''}`}
            onClick={() => handleSelect(i)}
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
