import { useEffect, useState } from 'react';
import { SCREEN_BREAKPOINTS } from '@/lib/screenSize';

const DEFAULT_WEEK_SUMMARY_STICKY_TOP_PX = 52;

const getScheduleScrollParent = (element: HTMLElement): HTMLElement => {
  let parent = element.parentElement;
  while (parent) {
    const { overflowY } = window.getComputedStyle(parent);
    if (/(auto|scroll|overlay)/.test(overflowY)) return parent;
    parent = parent.parentElement;
  }
  return document.documentElement;
};

interface UseScheduleWeekSummaryStuckOptions {
  active: boolean;
  sentinelRef: { current: HTMLDivElement | null };
  stickyTopPx?: number;
  stickyOnMobile?: boolean;
}

export const useScheduleWeekSummaryStuck = ({
  active,
  sentinelRef,
  stickyTopPx = DEFAULT_WEEK_SUMMARY_STICKY_TOP_PX,
  stickyOnMobile = false,
}: UseScheduleWeekSummaryStuckOptions): boolean => {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    if (!active) {
      setStuck(false);
      return;
    }

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const scrollElement = getScheduleScrollParent(sentinel);
    const mediaQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia(`(max-width: ${SCREEN_BREAKPOINTS.mobileMax}px)`)
        : null;
    let frame = 0;
    const isMobile = () =>
      mediaQuery?.matches ?? window.innerWidth <= SCREEN_BREAKPOINTS.mobileMax;
    const update = () => {
      frame = 0;
      const next =
        (stickyOnMobile || !isMobile()) &&
        sentinel.getBoundingClientRect().top <= stickyTopPx;
      setStuck((current) => (current === next ? current : next));
    };
    const scheduleUpdate = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    scrollElement.addEventListener('scroll', scheduleUpdate, { passive: true });
    if (mediaQuery) {
      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', scheduleUpdate);
      } else {
        mediaQuery.addListener(scheduleUpdate);
      }
    }
    scheduleUpdate();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      scrollElement.removeEventListener('scroll', scheduleUpdate);
      if (mediaQuery) {
        if (typeof mediaQuery.removeEventListener === 'function') {
          mediaQuery.removeEventListener('change', scheduleUpdate);
        } else {
          mediaQuery.removeListener(scheduleUpdate);
        }
      }
    };
  }, [active, sentinelRef, stickyOnMobile, stickyTopPx]);

  return stuck;
};
