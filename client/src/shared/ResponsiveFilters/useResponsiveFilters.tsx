import { useEffect, useState, type ReactNode } from 'react';
import Divider from '@jerecocc/tracker-ui/components/Divider/Divider';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import Toggle from '@jerecocc/tracker-ui/components/Toggle/Toggle';
import useScreenSize from '@/hooks/useScreenSize';
import type { ScreenSize } from '@/lib/screenSize';
import { ScheduleFilters } from '@/shared/ScheduleGamesLayout/ScheduleGamesLayout';
import styles from './ResponsiveFilters.module.scss';

/**
 * Lays filters out like the games page: on desktop they share one row under the section
 * header; on tablets and phones a toggle (for the section header's actions) opens them in a
 * Filters sheet.
 */
const useResponsiveFilters = (controls: (screenSize: ScreenSize) => ReactNode) => {
  const screenSize = useScreenSize();
  const compact = screenSize !== 'desktop';
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!compact) setOpen(false);
  }, [compact]);

  const toggle = compact ? (
    <Toggle
      variant="button"
      active={open}
      onActiveChange={setOpen}
      icon="filter_list"
      activeTooltip="Hide filters"
      inactiveTooltip="Show filters"
      ariaLabel={open ? 'Hide filters' : 'Show filters'}
    />
  ) : null;

  const filters = compact ? (
    <Modal
      open={open}
      title="Filters"
      onClose={() => setOpen(false)}
      hideFooter
    >
      <ScheduleFilters
        visible
        className={styles.drawerFilters}
      >
        {controls(screenSize)}
      </ScheduleFilters>
    </Modal>
  ) : (
    // A divider sets the row apart from the content below it.
    <div className={styles.row}>
      <div className={styles.rowControls}>{controls(screenSize)}</div>
      <Divider />
    </div>
  );

  return { screenSize, toggle, filters };
};

export default useResponsiveFilters;
