import { useState } from 'react';
import type { ReactNode } from 'react';
import styles from './Tabs.module.scss';

export interface Tab {
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  /** Optional controlled active index. */
  activeIndex?: number;
  onTabChange?: (index: number) => void;
  className?: string;
}

const Tabs = ({ tabs, activeIndex, onTabChange, className }: TabsProps) => {
  const [internal, setInternal] = useState(0);
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

      <div className={styles.tabPanel}>
        {tabs[active]?.content}
      </div>
    </div>
  );
};

export default Tabs;
