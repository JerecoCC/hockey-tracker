import { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import Accordion from '@/components/Accordion/Accordion';
import Skeleton from '@/components/Skeleton/Skeleton';
import styles from './MonthCalendar.module.scss';

const DEFAULT_DAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const daysInMonth = (year: number, monthIndex: number) =>
  new Date(year, monthIndex + 1, 0).getDate();

const firstDayOfWeek = (year: number, monthIndex: number) => new Date(year, monthIndex, 1).getDay();

const monthDayKey = (month: Date, day: number) =>
  `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export interface MonthCalendarDayArgs {
  dateKey: string;
  day: number;
}

export interface MonthCalendarEmptyCellArgs {
  index: number;
}

interface Props {
  month: Date;
  dayLabels?: string[];
  className?: string;
  gridClassName?: string;
  dayNameClassName?: string;
  emptyCellClassName?: string;
  dayCellClassName?: string;
  dayNumberClassName?: string;
  dayBodyClassName?: string;
  loading?: boolean;
  loadingSkeletonClassName?: string;
  getDayClassName?: (args: MonthCalendarDayArgs) => string | undefined;
  getDayBodyClassName?: (args: MonthCalendarDayArgs) => string | undefined;
  getDayLabelSuffix?: (args: MonthCalendarDayArgs) => ReactNode;
  getDayHeaderRight?: (args: MonthCalendarDayArgs) => ReactNode;
  getDayProps?: (args: MonthCalendarDayArgs) => HTMLAttributes<HTMLDivElement>;
  renderEmptyCellPlaceholder?: (args: MonthCalendarEmptyCellArgs) => ReactNode;
  renderDayPlaceholder?: (args: MonthCalendarDayArgs) => ReactNode;
  renderDayContent: (args: MonthCalendarDayArgs) => ReactNode;
}

interface MonthCalendarDayProps {
  args: MonthCalendarDayArgs;
  content: ReactNode;
  rootProps: HTMLAttributes<HTMLDivElement>;
  dayPropsClassName?: string;
  dayCellClassName?: string;
  dayNumberClassName?: string;
  dayBodyClassName?: string;
  getDayClassName?: (args: MonthCalendarDayArgs) => string | undefined;
  getDayBodyClassName?: (args: MonthCalendarDayArgs) => string | undefined;
  labelSuffix?: ReactNode;
  headerRight?: ReactNode;
}

const MonthCalendarDay = ({
  args,
  content,
  rootProps,
  dayPropsClassName,
  dayCellClassName,
  dayNumberClassName,
  dayBodyClassName,
  getDayClassName,
  getDayBodyClassName,
  labelSuffix,
  headerRight,
}: MonthCalendarDayProps) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [bodyScrollable, setBodyScrollable] = useState(false);

  useLayoutEffect(() => {
    let animationFrame = 0;

    const updateScrollable = () => {
      animationFrame = 0;
      const body = bodyRef.current;
      const contentElement = contentRef.current;

      if (body == null || contentElement == null) {
        setBodyScrollable(false);
        return;
      }

      const nextScrollable = body.scrollHeight - body.clientHeight > 1;
      setBodyScrollable((currentScrollable) =>
        currentScrollable === nextScrollable ? currentScrollable : nextScrollable,
      );
    };

    const scheduleUpdate = () => {
      if (animationFrame) return;
      animationFrame = requestAnimationFrame(updateScrollable);
    };

    updateScrollable();
    scheduleUpdate();

    if (typeof ResizeObserver === 'undefined') {
      return () => cancelAnimationFrame(animationFrame);
    }

    const observer = new ResizeObserver(scheduleUpdate);
    if (bodyRef.current != null) observer.observe(bodyRef.current);
    if (contentRef.current != null) observer.observe(contentRef.current);
    const renderedContent = contentRef.current?.firstElementChild;
    if (renderedContent instanceof HTMLElement) observer.observe(renderedContent);

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [content]);

  return (
    <Accordion
      {...rootProps}
      label={
        <span className={[styles.dayNumber, dayNumberClassName].filter(Boolean).join(' ')}>
          {args.day}
          {labelSuffix}
        </span>
      }
      variant="static"
      className={[styles.dayCell, dayCellClassName, getDayClassName?.(args), dayPropsClassName]
        .filter(Boolean)
        .join(' ')}
      rowClassName={styles.dayHeader}
      bodyClassName={[
        styles.dayBody,
        bodyScrollable ? styles.dayBodyScrollable : '',
        dayBodyClassName,
        getDayBodyClassName?.(args),
      ]
        .filter(Boolean)
        .join(' ')}
      bodyRef={bodyRef}
      headerRight={headerRight}
    >
      <div
        ref={contentRef}
        className={styles.dayContent}
      >
        {content}
      </div>
    </Accordion>
  );
};

interface MonthCalendarLoadingSkeletonProps {
  className?: string;
}

const MonthCalendarLoadingSkeleton = ({ className }: MonthCalendarLoadingSkeletonProps) => (
  <Skeleton
    type="block"
    className={[styles.loadingSkeleton, className].filter(Boolean).join(' ')}
  />
);

const MonthCalendar = forwardRef<HTMLDivElement, Props>(
  (
    {
      month,
      dayLabels = DEFAULT_DAY_LABELS,
      className,
      gridClassName,
      dayNameClassName,
      emptyCellClassName,
      dayCellClassName,
      dayNumberClassName,
      dayBodyClassName,
      loading = false,
      loadingSkeletonClassName,
      getDayClassName,
      getDayBodyClassName,
      getDayLabelSuffix,
      getDayHeaderRight,
      getDayProps,
      renderEmptyCellPlaceholder,
      renderDayPlaceholder,
      renderDayContent,
    },
    ref,
  ) => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const cells: (number | null)[] = Array(firstDayOfWeek(year, monthIndex)).fill(null);

    for (let day = 1; day <= daysInMonth(year, monthIndex); day++) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div
        ref={ref}
        className={[styles.grid, gridClassName, className].filter(Boolean).join(' ')}
        aria-busy={loading || undefined}
      >
        {dayLabels.map((label) => (
          <div
            key={label}
            className={[styles.dayName, dayNameClassName].filter(Boolean).join(' ')}
          >
            {label}
          </div>
        ))}
        {cells.map((day, index) => {
          if (day === null) {
            if (loading) {
              return (
                <div
                  key={`blank-${index}`}
                  className={[styles.dayCell, styles.dayPlaceholderCell, emptyCellClassName]
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={`Loading calendar slot ${index + 1}`}
                >
                  <MonthCalendarLoadingSkeleton className={loadingSkeletonClassName} />
                </div>
              );
            }

            if (renderEmptyCellPlaceholder) {
              return (
                <div
                  key={`blank-${index}`}
                  className={[styles.dayCell, styles.dayPlaceholderCell, emptyCellClassName]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {renderEmptyCellPlaceholder({ index })}
                </div>
              );
            }

            return (
              <div
                key={`blank-${index}`}
                className={[styles.emptyCell, emptyCellClassName].filter(Boolean).join(' ')}
              />
            );
          }

          const args = { dateKey: monthDayKey(month, day), day };

          if (loading) {
            return (
              <div
                key={args.dateKey}
                className={[styles.dayCell, styles.dayPlaceholderCell, dayCellClassName]
                  .filter(Boolean)
                  .join(' ')}
                aria-label={`Loading games for ${args.dateKey}`}
              >
                <MonthCalendarLoadingSkeleton className={loadingSkeletonClassName} />
              </div>
            );
          }

          const dayProps = getDayProps?.(args) ?? {};
          const { className: dayPropsClassName, ...rootProps } = dayProps;

          if (renderDayPlaceholder) {
            return (
              <div
                {...rootProps}
                key={args.dateKey}
                className={[
                  styles.dayCell,
                  styles.dayPlaceholderCell,
                  dayCellClassName,
                  getDayClassName?.(args),
                  dayPropsClassName,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {renderDayPlaceholder(args)}
              </div>
            );
          }

          const content = renderDayContent(args);

          return (
            <MonthCalendarDay
              key={args.dateKey}
              args={args}
              content={content}
              rootProps={rootProps}
              dayPropsClassName={dayPropsClassName}
              dayCellClassName={dayCellClassName}
              dayNumberClassName={dayNumberClassName}
              dayBodyClassName={dayBodyClassName}
              getDayClassName={getDayClassName}
              getDayBodyClassName={getDayBodyClassName}
              labelSuffix={getDayLabelSuffix?.(args)}
              headerRight={getDayHeaderRight?.(args)}
            />
          );
        })}
      </div>
    );
  },
);

MonthCalendar.displayName = 'MonthCalendar';

export default MonthCalendar;
