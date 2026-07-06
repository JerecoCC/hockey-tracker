import { useEffect, useState } from 'react';
import type { CSSProperties, MutableRefObject, ReactNode, Ref } from 'react';
import { Link } from 'react-router-dom';
import Badge from '@/components/Badge/Badge';
import Divider from '@/components/Divider/Divider';
import Section from '@/components/Section/Section';
import Icon from '@/components/Icon/Icon';
import MonthCalendar from '@/components/MonthCalendar/MonthCalendar';
import Skeleton from '@/components/Skeleton/Skeleton';
import styles from './ScheduleGamesLayout.module.scss';

export type ScheduleDayGroup<T> = readonly [dateKey: string, items: T[]];

const WEEK_SUMMARY_MOBILE_BREAKPOINT = 768;
const DEFAULT_WEEK_SUMMARY_STICKY_TOP_PX = 52;

const getScheduleScrollParent = (el: HTMLElement): HTMLElement => {
  let parent = el.parentElement;
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
}

export const useScheduleWeekSummaryStuck = ({
  active,
  sentinelRef,
  stickyTopPx = DEFAULT_WEEK_SUMMARY_STICKY_TOP_PX,
}: UseScheduleWeekSummaryStuckOptions): boolean => {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    if (!active) {
      setStuck(false);
      return;
    }

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const scrollEl = getScheduleScrollParent(sentinel);
    const mediaQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia(`(max-width: ${WEEK_SUMMARY_MOBILE_BREAKPOINT}px)`)
        : null;
    let frame = 0;

    const isMobile = () =>
      mediaQuery?.matches ?? window.innerWidth <= WEEK_SUMMARY_MOBILE_BREAKPOINT;

    const update = () => {
      frame = 0;
      const next = !isMobile() && sentinel.getBoundingClientRect().top <= stickyTopPx;
      setStuck((current) => (current === next ? current : next));
    };

    const scheduleUpdate = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    scrollEl.addEventListener('scroll', scheduleUpdate, { passive: true });
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
      scrollEl.removeEventListener('scroll', scheduleUpdate);
      if (mediaQuery) {
        if (typeof mediaQuery.removeEventListener === 'function') {
          mediaQuery.removeEventListener('change', scheduleUpdate);
        } else {
          mediaQuery.removeListener(scheduleUpdate);
        }
      }
    };
  }, [active, sentinelRef, stickyTopPx]);

  return stuck;
};

interface ScheduleGamesTitleProps {
  title?: ReactNode;
  picker?: ReactNode;
}

export const ScheduleGamesTitle = ({ title = 'Games', picker }: ScheduleGamesTitleProps) => (
  <>
    {title}
    {picker && (
      <>
        <Divider
          variant="vertical"
        />
        <span className={styles.weekNav}>{picker}</span>
      </>
    )}
  </>
);

interface ScheduleGamesActionsProps {
  children: ReactNode;
  className?: string;
}

export const ScheduleGamesActions = ({ children, className }: ScheduleGamesActionsProps) => (
  <div className={[styles.actionsRow, className].filter(Boolean).join(' ')}>{children}</div>
);

interface ScheduleFiltersProps {
  visible: boolean;
  children: ReactNode;
  className?: string;
}

export const ScheduleFilters = ({ visible, children, className }: ScheduleFiltersProps) => (
  <div
    className={[styles.filters, !visible && styles.filtersHidden, className]
      .filter(Boolean)
      .join(' ')}
  >
    <Divider className={styles.filtersDivider} />
    {children}
  </div>
);

interface ScheduleFilterSlotProps {
  children: ReactNode;
  wide?: boolean;
  fixed?: boolean;
  className?: string;
}

export const ScheduleFilterSlot = ({
  children,
  wide = false,
  fixed = false,
  className,
}: ScheduleFilterSlotProps) => (
  <div
    className={[
      wide && styles.filterSlotWide,
      fixed && styles.filterSlotFixed,
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    {children}
  </div>
);

interface ScheduleWeekSummaryProps<T> {
  days: readonly ScheduleDayGroup<T>[];
  loading: boolean;
  activeDateKey?: string;
  stuck?: boolean;
  onSelectDate: (dateKey: string) => void;
  formatDate: (dateKey: string) => ReactNode;
  formatWeekday: (dateKey: string) => ReactNode;
  formatHeading: (dateKey: string) => string;
  summaryRef?: Ref<HTMLDivElement>;
  stickyTop?: string;
}

export const ScheduleWeekSummary = <T,>({
  days,
  loading,
  activeDateKey,
  stuck = false,
  onSelectDate,
  formatDate,
  formatWeekday,
  formatHeading,
  summaryRef,
  stickyTop,
}: ScheduleWeekSummaryProps<T>) => (
  <Section
    ref={summaryRef}
    className={[styles.weekSummaryCard, stuck && styles.weekSummaryCardStuck]
      .filter(Boolean)
      .join(' ')}
    style={
      stickyTop ? ({ '--week-summary-sticky-top': stickyTop } as CSSProperties) : undefined
    }
    noHeaderMargin
  >
    <div className={styles.weekSummaryGrid}>
      {days.map(([dateKey, dayGames]) => {
        const isActive = activeDateKey === dateKey;
        return (
          <button
            key={dateKey}
            type="button"
            className={[styles.weekSummaryDay, isActive && styles.weekSummaryDayActive]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onSelectDate(dateKey)}
            aria-label={
              loading
                ? `Loading games for ${formatHeading(dateKey)}`
                : `Jump to ${formatHeading(dateKey)}: ${dayGames.length} games`
            }
          >
            <span className={styles.weekSummaryDayRow}>
              <span className={styles.weekSummaryDate}>{formatDate(dateKey)}</span>
              <span className={styles.weekSummaryWeekday}>{formatWeekday(dateKey)}</span>
            </span>
            <span
              className={[styles.weekSummaryDayRow, styles.weekSummaryCountRow]
                .filter(Boolean)
                .join(' ')}
            >
              <span className={styles.weekSummaryCount}>
                {loading ? (
                  <Skeleton
                    type="text"
                    className={styles.weekSummaryCountSkeleton}
                  />
                ) : (
                  <>
                    {dayGames.length} {dayGames.length === 1 ? 'Game' : 'Games'}
                  </>
                )}
              </span>
              {isActive && (
                <Icon
                  name="calendar_today"
                  className={styles.weekSummaryIcon}
                />
              )}
            </span>
          </button>
        );
      })}
    </div>
  </Section>
);

interface ScheduleWeekListProps<T> {
  days: readonly ScheduleDayGroup<T>[];
  loading?: boolean;
  dayRefs?: MutableRefObject<Record<string, HTMLDivElement | null>>;
  formatHeading: (dateKey: string) => string;
  getDayTitleLink?: (
    dateKey: string,
    dayGames: T[],
  ) =>
    | {
        href: string;
        ariaLabel?: string;
      }
    | null
    | undefined;
  renderDayAction?: (dateKey: string, dayGames: T[]) => ReactNode;
  renderDayContent: (dateKey: string, dayGames: T[]) => ReactNode;
  getEmptyMessage?: (dateKey: string, dayGames: T[]) => ReactNode;
  renderLoading?: (dateKey: string) => ReactNode;
}

export const ScheduleWeekList = <T,>({
  days,
  loading = false,
  dayRefs,
  formatHeading,
  getDayTitleLink,
  renderDayAction,
  renderDayContent,
  getEmptyMessage = () => 'No games scheduled.',
  renderLoading,
}: ScheduleWeekListProps<T>) => (
  <div className={styles.dayList}>
    {days.map(([dateKey, dayGames]) => {
      const heading = formatHeading(dateKey);
      const titleLink = getDayTitleLink?.(dateKey, dayGames);
      const title = titleLink ? (
        <Link
          to={titleLink.href}
          className={styles.dayTitleLink}
          aria-label={titleLink.ariaLabel ?? `View games for ${heading}`}
        >
          <span>{heading}</span>
          <span
            className={styles.dayTitleLinkIndicator}
            aria-hidden
          >
            <Icon
              name="open_in_new"
              size="0.85rem"
            />
          </span>
        </Link>
      ) : (
        heading
      );

      return (
        <div
          key={dateKey}
          ref={(node) => {
            if (dayRefs) dayRefs.current[dateKey] = node;
          }}
          className={styles.dayCardAnchor}
        >
          <Section
            title={title}
            action={renderDayAction?.(dateKey, dayGames)}
          >
            {loading ? (
              (renderLoading?.(dateKey) ?? <ScheduleWeekDaySkeletons dateLabel={heading} />)
            ) : dayGames.length === 0 ? (
              <p className={styles.dayEmpty}>{getEmptyMessage(dateKey, dayGames)}</p>
            ) : (
              renderDayContent(dateKey, dayGames)
            )}
          </Section>
        </div>
      );
    })}
  </div>
);

interface ScheduleWeekDaySkeletonsProps {
  dateLabel: string;
}

export const ScheduleWeekDaySkeletons = ({ dateLabel }: ScheduleWeekDaySkeletonsProps) => (
  <div
    className={styles.weekGameSkeletonGrid}
    aria-label={`Loading games for ${dateLabel}`}
  >
    {Array.from({ length: 3 }).map((_, index) => (
      <Skeleton
        key={index}
        type="block"
        className={styles.weekGameSkeleton}
      />
    ))}
  </div>
);

interface ScheduleGameListProps {
  children: ReactNode;
}

export const ScheduleGameList = ({ children }: ScheduleGameListProps) => (
  <ul className={styles.list}>{children}</ul>
);

export const ScheduleGameStack = ({ children }: ScheduleGameListProps) => (
  <div className={styles.list}>{children}</div>
);

interface ScheduleCalendarCardProps {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
}

export const ScheduleCalendarCard = ({
  children,
  className,
  title,
  action,
}: ScheduleCalendarCardProps) => (
  <Section
    className={[styles.calendarCard, className].filter(Boolean).join(' ')}
    title={title}
    action={action}
    noHeaderMargin={!title && !action}
  >
    <div className={styles.calendarWrap}>
      <div className={styles.calendarScroll}>{children}</div>
    </div>
  </Section>
);

interface ScheduleCalendarLoadingProps {
  month: Date;
}

export const ScheduleCalendarLoading = ({ month }: ScheduleCalendarLoadingProps) => (
  <ScheduleCalendarCard>
    <MonthCalendar
      month={month}
      loading
      loadingSkeletonClassName={styles.calendarDaySkeleton}
      renderDayContent={() => null}
    />
  </ScheduleCalendarCard>
);

export const ScheduleCalendarGameList = ({ children }: ScheduleGameListProps) => (
  <div className={styles.calendarGameList}>{children}</div>
);

interface ScheduleCalendarDayCountProps {
  count: number;
  label?: string;
  showLabel?: boolean;
}

const getScheduleCalendarDayCountLabel = (count: number) => (count === 1 ? 'game' : 'games');

export const ScheduleCalendarDayCount = ({
  count,
  label,
  showLabel = false,
}: ScheduleCalendarDayCountProps) => {
  const countLabel = getScheduleCalendarDayCountLabel(count);

  if (count <= 0) return null;

  return (
    <Badge
      className={styles.calendarDayCount}
      value={count}
      label={label ?? (showLabel ? countLabel : undefined)}
      aria-label={`${count} ${countLabel}`}
    />
  );
};

export const scheduleViewSegmentedControlClassName = styles.viewSegmentedControl;
