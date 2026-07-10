import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useForm } from 'react-hook-form';
import ActionOverlay from '@jerecocc/tracker-ui/components/ActionOverlay/ActionOverlay';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import ConfirmModal from '@jerecocc/tracker-ui/components/ConfirmModal/ConfirmModal';
import Field from '@jerecocc/tracker-ui/components/Field/Field';
import GroupedFields from '@jerecocc/tracker-ui/components/GroupedFields/GroupedFields';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import Slider from '@jerecocc/tracker-ui/components/Slider/Slider';
import Tag from '@jerecocc/tracker-ui/components/Tag/Tag';
import Tooltip from '@jerecocc/tracker-ui/components/Tooltip/Tooltip';
import useLeagueDraftDates, {
  type LeagueDraftDateRecord,
  type LeagueDraftEventPayload,
} from '@/hooks/useLeagueDraftDates';
import {
  LeagueListRowSkeleton,
  TabActionSkeleton,
  type TabSkeletonProps,
} from './LeagueTabSkeletonHelpers';
import styles from './LeagueDetails.module.scss';

interface DraftFormValues {
  startDate: string;
  endDate: string;
  totalRounds: string;
}

interface DraftDayRange {
  date: string;
  startRound: number;
  endRound: number;
}

interface DraftEvent {
  draftYear: number;
  rows: LeagueDraftDateRecord[];
  startDate: string;
  endDate: string;
  totalRounds: number;
}

interface DraftTimelineSegment {
  startRound: number;
  endRound: number;
  draftDate: LeagueDraftDateRecord | null;
  dayIndex: number | null;
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DRAFT_EVENT_DAYS = 31;

const emptyValues: DraftFormValues = {
  startDate: '',
  endDate: '',
  totalRounds: '',
};

const toInteger = (value: string | number | null | undefined) => {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

const parseDateOnly = (value: string) => {
  if (!DATE_ONLY_RE.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
};

const formatDateOnly = (date: Date) => date.toISOString().slice(0, 10);

const addUtcDays = (date: Date, days: number) => {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const getDateRange = (startDate: string, endDate: string) => {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (!start || !end || end < start) return [];

  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addUtcDays(cursor, 1)) {
    dates.push(formatDateOnly(cursor));
    if (dates.length > MAX_DRAFT_EVENT_DAYS) return [];
  }
  return dates;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

const formatDateRange = (startDate: string, endDate: string) =>
  startDate === endDate
    ? formatDate(startDate)
    : `${formatDate(startDate)} - ${formatDate(endDate)}`;

const formatMonthDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
  });

const formatRoundRange = (draftDate: Pick<LeagueDraftDateRecord, 'start_round' | 'end_round'>) =>
  draftDate.start_round === draftDate.end_round
    ? `Round ${draftDate.start_round}`
    : `Rounds ${draftDate.start_round}-${draftDate.end_round}`;

const normalizeDayRanges = (
  dates: string[],
  totalRounds: number | null,
  previous: DraftDayRange[] = [],
) => {
  if (!totalRounds || dates.length === 0 || totalRounds < dates.length) return [];

  const previousByDate = new Map(previous.map((day) => [day.date, day]));
  const ranges: DraftDayRange[] = [];
  let nextStartRound = 1;

  dates.forEach((date, index) => {
    const remainingDays = dates.length - index - 1;
    const startRound = nextStartRound;
    const maxEndRound = totalRounds - remainingDays;
    const fallbackEndRound =
      index === dates.length - 1
        ? totalRounds
        : clamp(Math.ceil(((index + 1) * totalRounds) / dates.length), startRound, maxEndRound);
    const preferredEndRound =
      previousByDate.get(date)?.endRound ?? previous[index]?.endRound ?? fallbackEndRound;
    const endRound =
      index === dates.length - 1 ? totalRounds : clamp(preferredEndRound, startRound, maxEndRound);

    ranges.push({ date, startRound, endRound });
    nextStartRound = endRound + 1;
  });

  return ranges;
};

const buildDraftEvents = (draftDates: LeagueDraftDateRecord[]) => {
  const byYear = new Map<number, LeagueDraftDateRecord[]>();
  draftDates.forEach((row) => {
    const rows = byYear.get(row.draft_year) ?? [];
    rows.push(row);
    byYear.set(row.draft_year, rows);
  });

  return Array.from(byYear.entries())
    .map(([draftYear, rows]): DraftEvent => {
      const sortedRows = [...rows].sort(
        (left, right) =>
          left.draft_date.localeCompare(right.draft_date) || left.start_round - right.start_round,
      );
      const dates = sortedRows.map((row) => row.draft_date);
      return {
        draftYear,
        rows: sortedRows,
        startDate: dates[0],
        endDate: dates[dates.length - 1],
        totalRounds: Math.max(...sortedRows.map((row) => row.end_round)),
      };
    })
    .sort((left, right) => right.draftYear - left.draftYear);
};

const buildDraftTimelineSegments = (rows: LeagueDraftDateRecord[], totalRoundColumns: number) => {
  const segments: DraftTimelineSegment[] = [];
  let nextRound = 1;

  rows.forEach((row, dayIndex) => {
    const startRound = clamp(row.start_round, 1, totalRoundColumns);
    const endRound = clamp(row.end_round, startRound, totalRoundColumns);

    while (nextRound < startRound) {
      segments.push({
        startRound: nextRound,
        endRound: nextRound,
        draftDate: null,
        dayIndex: null,
      });
      nextRound += 1;
    }

    const visibleStartRound = Math.max(startRound, nextRound);
    if (endRound >= visibleStartRound) {
      segments.push({
        startRound: visibleStartRound,
        endRound,
        draftDate: row,
        dayIndex,
      });
      nextRound = endRound + 1;
    }
  });

  while (nextRound <= totalRoundColumns) {
    segments.push({
      startRound: nextRound,
      endRound: nextRound,
      draftDate: null,
      dayIndex: null,
    });
    nextRound += 1;
  }

  return segments;
};

const LeagueDraftsTab = ({ leagueId, className }: { leagueId: string; className?: string }) => {
  const { draftDates, loading, createDraftEvent, updateDraftEvent, deleteDraftEvent } =
    useLeagueDraftDates(leagueId);
  const draftEvents = useMemo(() => buildDraftEvents(draftDates), [draftDates]);
  const totalRoundColumns = useMemo(
    () => Math.max(0, ...draftEvents.map((draftEvent) => draftEvent.totalRounds)),
    [draftEvents],
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DraftEvent | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DraftEvent | null>(null);
  const [dayRanges, setDayRanges] = useState<DraftDayRange[]>([]);
  const [rangeDirty, setRangeDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<DraftFormValues>({
    defaultValues: emptyValues,
    mode: 'onChange',
  });

  const startDateValue = form.watch('startDate');
  const endDateValue = form.watch('endDate');
  const totalRoundsValue = form.watch('totalRounds');
  const totalRounds = toInteger(totalRoundsValue);
  const parsedStartDate = parseDateOnly(startDateValue);
  const parsedEndDate = parseDateOnly(endDateValue);
  const draftYear = parsedStartDate?.getUTCFullYear() ?? null;
  const datesCrossYears =
    parsedStartDate !== null &&
    parsedEndDate !== null &&
    parsedStartDate.getUTCFullYear() !== parsedEndDate.getUTCFullYear();
  const draftYearOutOfRange = draftYear !== null && (draftYear < 1900 || draftYear > 2200);
  const draftDatesInRange = useMemo(() => {
    const startDate = parseDateOnly(startDateValue);
    const endDate = parseDateOnly(endDateValue);
    if (startDate && endDate && startDate.getUTCFullYear() !== endDate.getUTCFullYear()) {
      return [];
    }
    return getDateRange(startDateValue, endDateValue);
  }, [startDateValue, endDateValue]);
  const dateRangeOverflow =
    !!startDateValue &&
    !!endDateValue &&
    !datesCrossYears &&
    DATE_ONLY_RE.test(startDateValue) &&
    DATE_ONLY_RE.test(endDateValue) &&
    draftDatesInRange.length === 0 &&
    parsedEndDate !== null &&
    parsedStartDate !== null &&
    parsedEndDate >= parsedStartDate;
  const invalidDateRange =
    !!startDateValue &&
    !!endDateValue &&
    !datesCrossYears &&
    (draftDatesInRange.length === 0 || dateRangeOverflow);
  const totalRoundsTooLow =
    totalRounds !== null && draftDatesInRange.length > 0 && totalRounds < draftDatesInRange.length;

  useEffect(() => {
    if (datesCrossYears) return;
    setDayRanges((previous) => normalizeDayRanges(draftDatesInRange, totalRounds, previous));
  }, [datesCrossYears, draftDatesInRange, totalRounds]);

  if (loading) return <LeagueDraftsTabSkeleton className={className} />;

  const openCreate = () => {
    setEditTarget(null);
    form.reset(emptyValues);
    setDayRanges([]);
    setRangeDirty(false);
    setModalOpen(true);
  };

  const populateDraftForm = (draftEvent: DraftEvent) => {
    form.reset({
      startDate: draftEvent.startDate,
      endDate: draftEvent.endDate,
      totalRounds: String(draftEvent.totalRounds),
    });
    setDayRanges(
      draftEvent.rows.map((row) => ({
        date: row.draft_date,
        startRound: row.start_round,
        endRound: row.end_round,
      })),
    );
    setRangeDirty(false);
  };

  const openCopy = (draftEvent: DraftEvent) => {
    setEditTarget(null);
    populateDraftForm(draftEvent);
    setModalOpen(true);
  };

  const openEdit = (draftEvent: DraftEvent) => {
    setEditTarget(draftEvent);
    populateDraftForm(draftEvent);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditTarget(null);
    form.reset(emptyValues);
    setDayRanges([]);
    setRangeDirty(false);
    setSubmitting(false);
  };

  const updateDayRoundRange = (index: number, value: [number, number]) => {
    setDayRanges((current) => {
      const next = normalizeDayRanges(draftDatesInRange, totalRounds, current);
      const day = next[index];
      if (!day || !totalRounds) return next;

      const previousDay = next[index - 1];
      const remainingDays = next.length - index - 1;
      const maxEndRound = totalRounds - remainingDays;
      const nextStartRound = previousDay
        ? clamp(value[0], previousDay.startRound + 1, day.endRound)
        : day.startRound;
      const nextEndRound =
        index === next.length - 1 ? totalRounds : clamp(value[1], nextStartRound, maxEndRound);

      if (previousDay) {
        next[index - 1] = { ...previousDay, endRound: nextStartRound - 1 };
      }
      next[index] = { ...day, endRound: nextEndRound };
      return normalizeDayRanges(draftDatesInRange, totalRounds, next);
    });
    setRangeDirty(true);
  };

  const canSubmit =
    (form.formState.isDirty || rangeDirty) &&
    !submitting &&
    form.formState.isValid &&
    !!draftYear &&
    draftYear >= 1900 &&
    draftYear <= 2200 &&
    !draftYearOutOfRange &&
    !!startDateValue &&
    !!endDateValue &&
    !!totalRounds &&
    totalRounds > 1 &&
    !datesCrossYears &&
    !invalidDateRange &&
    !totalRoundsTooLow &&
    dayRanges.length === draftDatesInRange.length &&
    dayRanges.length > 0;

  const submit = form.handleSubmit(async (values) => {
    if (!canSubmit || !draftYear || !totalRounds) return;

    const payload: LeagueDraftEventPayload = {
      draft_year: draftYear,
      start_date: values.startDate,
      end_date: values.endDate,
      total_rounds: totalRounds,
      days: dayRanges.map((day) => ({
        draft_date: day.date,
        start_round: day.startRound,
        end_round: day.endRound,
      })),
    };

    setSubmitting(true);
    const ok = editTarget
      ? await updateDraftEvent(editTarget.draftYear, payload)
      : await createDraftEvent(payload);
    setSubmitting(false);
    if (ok) closeModal();
  });

  return (
    <>
      <div className={styles.grid}>
        <Section
          className={[styles.col12, className].filter(Boolean).join(' ')}
          title="Drafts"
          action={
            <Button
              icon="add"
              size="medium"
              onClick={openCreate}
            >
              Create Draft
            </Button>
          }
        >
          {draftEvents.length === 0 ? (
            <p className={styles.emptyMsg}>
              No drafts configured yet. Add draft dates so drafted player stints can use the correct
              start date.
            </p>
          ) : (
            <div className={styles.draftTimelineScroll}>
              <table
                className={styles.draftTimelineTable}
                aria-label="Draft schedule by round"
                style={{ '--draft-round-count': totalRoundColumns } as CSSProperties}
              >
                <caption className={styles.srOnly}>
                  Draft years and the rounds held on each draft day
                </caption>
                <colgroup>
                  <col className={styles.draftTimelineYearColumn} />
                  {Array.from({ length: totalRoundColumns }, (_, index) => (
                    <col
                      key={index + 1}
                      className={styles.draftTimelineRoundColumn}
                    />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className={styles.draftTimelineYearHeader}
                    >
                      Draft year
                    </th>
                    {Array.from({ length: totalRoundColumns }, (_, index) => (
                      <th
                        key={index + 1}
                        scope="col"
                        className={styles.draftTimelineRoundHeader}
                      >
                        <span>Round</span>
                        <strong>{index + 1}</strong>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {draftEvents.map((item) => {
                    const timelineSegments = buildDraftTimelineSegments(
                      item.rows,
                      totalRoundColumns,
                    );
                    const scheduledSegments = timelineSegments.filter(
                      (segment) => segment.draftDate && segment.dayIndex !== null,
                    );
                    const scheduledByStartRound = new Map(
                      scheduledSegments.map((segment) => [segment.startRound, segment]),
                    );

                    return (
                      <tr key={item.draftYear}>
                        <th
                          scope="row"
                          className={styles.draftTimelineYearCell}
                        >
                          <div className={styles.draftTimelineYearMain}>
                            <strong className={styles.draftTimelineYear}>{item.draftYear}</strong>
                            <span className={styles.draftTimelineDates}>
                              {formatDateRange(item.startDate, item.endDate)}
                            </span>
                          </div>
                          <ActionOverlay
                            className={styles.draftTimelineActions}
                            data-hover-actions
                          >
                            <Button
                              variant="outlined"
                              intent="neutral"
                              icon="clone"
                              tooltip="Create copy"
                              aria-label={`Create copy of ${item.draftYear} draft`}
                              onClick={() => openCopy(item)}
                            />
                            <Button
                              variant="outlined"
                              intent="neutral"
                              icon="edit"
                              tooltip="Edit draft"
                              aria-label={`Edit ${item.draftYear} draft`}
                              onClick={() => openEdit(item)}
                            />
                            <Button
                              variant="outlined"
                              intent="danger"
                              icon="delete"
                              tooltip="Remove draft"
                              aria-label={`Remove ${item.draftYear} draft`}
                              onClick={() => setConfirmDelete(item)}
                            />
                          </ActionOverlay>
                        </th>
                        {Array.from({ length: totalRoundColumns }, (_, index) => {
                          const round = index + 1;
                          const coveringSegment = scheduledSegments.find(
                            (segment) => round >= segment.startRound && round <= segment.endRound,
                          );
                          const startingSegment = scheduledByStartRound.get(round);

                          if (!startingSegment?.draftDate || startingSegment.dayIndex === null) {
                            return (
                              <td
                                key={round}
                                className={styles.draftTimelineRoundCell}
                                aria-label={
                                  coveringSegment?.dayIndex !== null &&
                                  coveringSegment?.dayIndex !== undefined
                                    ? `Round ${round}, Day ${coveringSegment.dayIndex + 1}`
                                    : `Round ${round} not scheduled`
                                }
                              />
                            );
                          }

                          const roundSpan =
                            startingSegment.endRound - startingSegment.startRound + 1;
                          const fullDate = formatDate(startingSegment.draftDate.draft_date);
                          const roundRange = formatRoundRange({
                            start_round: startingSegment.startRound,
                            end_round: startingSegment.endRound,
                          });
                          const rangeLabel = `Day ${startingSegment.dayIndex + 1}, ${fullDate}, ${roundRange}`;

                          return (
                            <td
                              key={round}
                              className={styles.draftTimelineRoundCell}
                              aria-label={`Round ${round}, Day ${startingSegment.dayIndex + 1}`}
                              style={
                                {
                                  '--draft-range-width': `calc(${roundSpan * 100}% + ${roundSpan - 1}px - 1rem)`,
                                } as CSSProperties
                              }
                            >
                              <Tooltip
                                text={`${fullDate}: ${roundRange}`}
                                className={styles.draftTimelineDayTooltip}
                              >
                                <div
                                  className={styles.draftTimelineDay}
                                  aria-label={rangeLabel}
                                  data-round-span={roundSpan}
                                >
                                  <span>Day {startingSegment.dayIndex + 1}</span>
                                  <strong>
                                    {formatMonthDay(startingSegment.draftDate.draft_date)}
                                  </strong>
                                </div>
                              </Tooltip>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      <Modal
        open={modalOpen}
        title={editTarget ? 'Edit Draft' : 'Create Draft'}
        onClose={closeModal}
        confirmForm="league-draft-form"
        confirmLabel={submitting ? 'Saving...' : editTarget ? 'Save Changes' : 'Create Draft'}
        confirmIcon="save"
        confirmDisabled={!canSubmit}
        busy={submitting}
      >
        <form
          id="league-draft-form"
          className={styles.draftForm}
          onSubmit={submit}
        >
          <div className={styles.draftFormGrid}>
            <Field
              control={form.control}
              name="startDate"
              type="datepicker"
              label="Start Date"
              placeholder="YYYY-MM-DD"
              required
              disabled={submitting}
              rules={{ required: 'Start date is required' }}
            />
            <Field
              control={form.control}
              name="endDate"
              type="datepicker"
              label="End Date"
              placeholder="YYYY-MM-DD"
              required
              disabled={submitting}
              rules={{ required: 'End date is required' }}
            />
            <Field
              control={form.control}
              name="totalRounds"
              type="number"
              label="Total Rounds"
              wrapperClassName={styles.draftFormFullWidth}
              min={2}
              max={99}
              required
              disabled={submitting}
              rules={{
                required: 'Total rounds is required',
                min: { value: 2, message: 'Must be greater than 1' },
                max: { value: 99, message: 'Must be 99 or fewer' },
                validate: (value) => Number.isInteger(Number(value)) || 'Must be a whole number',
              }}
            />
          </div>

          {datesCrossYears && (
            <p className={styles.draftFormError}>
              Start and end dates must be within the same calendar year.
            </p>
          )}
          {draftYearOutOfRange && (
            <p className={styles.draftFormError}>Start date year must be between 1900 and 2200.</p>
          )}
          {invalidDateRange && (
            <p className={styles.draftFormError}>
              End date must be on or after start date and span no more than {MAX_DRAFT_EVENT_DAYS}{' '}
              days.
            </p>
          )}
          {totalRoundsTooLow && (
            <p className={styles.draftFormError}>
              Total rounds must be at least the number of draft days.
            </p>
          )}

          {!datesCrossYears && dayRanges.length > 0 && (
            <div className={styles.draftDayList}>
              {dayRanges.map((day, index) => {
                const isLastDay = index === dayRanges.length - 1;
                const previousDay = dayRanges[index - 1];
                const maxEndRound = totalRounds
                  ? totalRounds - (dayRanges.length - index - 1)
                  : day.endRound;
                const minStartRound = previousDay ? previousDay.startRound + 1 : day.startRound;
                const sliderMin = Math.min(day.startRound, minStartRound);
                const sliderMax = Math.max(day.startRound, maxEndRound);
                return (
                  <GroupedFields
                    key={day.date}
                    className={styles.draftDayGroup}
                    fieldsClassName={styles.draftDayGroupFields}
                    legend={`Day ${index + 1}`}
                  >
                    <div className={styles.draftDaySummary}>
                      <strong>{formatDate(day.date)}</strong>
                      <Tag
                        label={
                          day.startRound === day.endRound
                            ? `Round ${day.startRound}`
                            : `Rounds ${day.startRound}-${day.endRound}`
                        }
                        intent="info"
                      />
                    </div>
                    {index === 0 ? (
                      <Slider
                        className={styles.draftDaySlider}
                        label="End Round"
                        min={sliderMin}
                        max={sliderMax}
                        step={1}
                        value={day.endRound}
                        disabled={isLastDay || day.startRound >= sliderMax}
                        aria-label="Day 1 end round"
                        onChange={(value) => updateDayRoundRange(index, [day.startRound, value])}
                      />
                    ) : (
                      <Slider
                        className={styles.draftDaySlider}
                        variant="range"
                        label="Round Range"
                        min={sliderMin}
                        max={sliderMax}
                        step={1}
                        value={[day.startRound, day.endRound]}
                        disabledStart={sliderMin === sliderMax}
                        disabledEnd={isLastDay || day.startRound >= sliderMax}
                        startAriaLabel={`Day ${index + 1} start round`}
                        endAriaLabel={`Day ${index + 1} end round`}
                        onChange={(value) => updateDayRoundRange(index, value)}
                      />
                    )}
                  </GroupedFields>
                );
              })}
            </div>
          )}
        </form>
      </Modal>

      <ConfirmModal
        open={confirmDelete !== null}
        title="Remove Draft"
        body={
          <>
            Remove <strong>{confirmDelete?.draftYear} Draft</strong>?
          </>
        }
        confirmLabel="Remove"
        variant="danger"
        onConfirm={async () => {
          if (confirmDelete) await deleteDraftEvent(confirmDelete.draftYear);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
};

export const LeagueDraftsTabSkeleton = ({ className }: TabSkeletonProps) => (
  <div className={styles.grid}>
    <Section
      className={[styles.col12, className].filter(Boolean).join(' ')}
      title="Drafts"
      action={<TabActionSkeleton width="126px" />}
      role="status"
      aria-busy="true"
      aria-label="Loading drafts"
    >
      <ul className={styles.awardDefinitionList}>
        {Array.from({ length: 4 }, (_, index) => (
          <LeagueListRowSkeleton key={index} />
        ))}
      </ul>
    </Section>
  </div>
);

export default LeagueDraftsTab;
