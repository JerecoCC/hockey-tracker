import { useEffect, useState, type ReactNode } from 'react';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import Toggle from '@jerecocc/tracker-ui/components/Toggle/Toggle';
import useScreenSize from '@/hooks/useScreenSize';
import type { ScreenSize } from '@/lib/screenSize';
import styles from './ResponsiveFilters.module.scss';

/**
 * Lays a page out with its filters in their own section beside the main one on desktop, like
 * the linescore beside the game details summary. Tablets and phones have no room for the side
 * column, so a toggle (for the main section's header actions) opens them in a Filters sheet.
 */
const useResponsiveFilters = (controls: (screenSize: ScreenSize) => ReactNode) => {
  const screenSize = useScreenSize();
  const compact = screenSize !== 'desktop';
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!compact) setOpen(false);
  }, [compact]);

  // Kept to the right of the header, even when the section's title is hidden on phones.
  const toggle = compact ? (
    <span className={styles.toggle}>
      <Toggle
        variant="button"
        active={open}
        onActiveChange={setOpen}
        icon="filter_list"
        activeTooltip="Hide filters"
        inactiveTooltip="Show filters"
        ariaLabel={open ? 'Hide filters' : 'Show filters'}
      />
    </span>
  ) : null;

  const stack = <div className={styles.stack}>{controls(screenSize)}</div>;

  /** Wraps the page's main section: beside a Filters section on desktop, else with the sheet. */
  const layout = (main: ReactNode) =>
    compact ? (
      <>
        {main}
        <Modal
          open={open}
          title="Filters"
          onClose={() => setOpen(false)}
          hideFooter
        >
          {stack}
        </Modal>
      </>
    ) : (
      <div className={styles.layout}>
        <div className={styles.main}>{main}</div>
        <Section
          title="Filters"
          className={styles.panel}
        >
          {stack}
        </Section>
      </div>
    );

  return { screenSize, toggle, layout };
};

export default useResponsiveFilters;
