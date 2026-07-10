import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import ConfirmModal from '@jerecocc/tracker-ui/components/ConfirmModal/ConfirmModal';
import Divider from '@jerecocc/tracker-ui/components/Divider/Divider';
import Field from '@jerecocc/tracker-ui/components/Field/Field';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import Tag from '@jerecocc/tracker-ui/components/Tag/Tag';
import useLeagueDraftDates, {
  type LeagueDraftDateRecord,
  type LeagueDraftEventPayload,
} from '@/hooks/useLeagueDraftDates';
import Slider from '@/shared/Slider/Slider';
import {
  LeagueListRowSkeleton,
  TabActionSkeleton,
  type TabSkeletonProps,
} from './LeagueTabSkeletonHelpers';
import styles from './LeagueDetails.module.scss';

interface DraftFormValues {
  draftYear: string;
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
  dayCount: number;
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DRAFT_EVENT_DAYS = 31;

const emptyValues: DraftFormValues = {
  draftYear: '',
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
  startDate === endDate ? formatDate(startDate) : `${formatDate(startDate)} - ${formatDate(endDate)}`;

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
    const preferredEndRound = previousByDate.get(date)?.endRound ?? fallbackEndRound;
    const endRound =
      index === dates.length - 1
        ? totalRounds
        : clamp(preferredEndRound, startRound, maxEndRound);

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
          left.draft_date.localeCompare(right.draft_date) ||
          left.start_round - right.start_round,
      );
      const dates = sortedRows.map((row) => row.draft_date);
      const uniqueDates = Array.from(new Set(dates));
      return {
        draftYear,
        rows: sortedRows,
        startDate: dates[0],
        endDate: dates[dates.length - 1],
        totalRounds: Math.max(...sortedRows.map((row) => row.end_round)),
        dayCount: uniqueDates.length,
      };
    })
    .sort((left, right) => right.draftYear - left.draftYear);
};

const LeagueDraftsTab = ({
  leagueId,
  className,
}: {
  leagueId: string;
  className?: string;
}) => {
  const { draftDates, loading, createDraftEvent, updateDraftEvent, deleteDraftEvent } =
    useLeagueDraftDates(leagueId);
  const draftEvents = useMemo(() => buildDraftEvents(draftDates), [draftDates]);
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

  const draftYearValue = form.watch('draftYear');
  const startDateValue = form.watch('startDate');
  const endDateValue = form.watch('endDate');
  const totalRoundsValue = form.watch('totalRounds');
  const draftYear = toInteger(draftYearValue);
  const totalRounds = toInteger(totalRoundsValue);
  const draftDatesInRange = useMemo(
    () => getDateRange(startDateValue, endDateValue),
    [startDateValue, endDateValue],
  );
  const parsedStartDate = parseDateOnly(startDateValue);
  const parsedEndDate = parseDateOnly(endDateValue);
  const dateRangeOverflow =
    !!startDateValue &&
    !!endDateValue &&
    DATE_ONLY_RE.test(startDateValue) &&
    DATE_ONLY_RE.test(endDateValue) &&
    draftDatesInRange.length === 0 &&
    parsedEndDate !== null &&
    parsedStartDate !== null &&
    parsedEndDate >= parsedStartDate;
  const invalidDateRange =
    !!startDateValue &&
    !!endDateValue &&
    (draftDatesInRange.length === 0 || dateRangeOverflow);
  const totalRoundsTooLow =
    totalRounds !== null && draftDatesInRange.length > 0 && totalRounds < draftDatesInRange.length;

  useEffect(() => {
    setDayRanges((previous) => normalizeDayRanges(draftDatesInRange, totalRounds, previous));
  }, [draftDatesInRange, totalRounds]);

  if (loading) return <LeagueDraftsTabSkeleton className={className} />;

  const openCreate = () => {
    setEditTarget(null);
    form.reset(emptyValues);
    setDayRanges([]);
    setRangeDirty(false);
    setModalOpen(true);
  };

  const openEdit = (draftEvent: DraftEvent) => {
    setEditTarget(draftEvent);
    form.reset({
      draftYear: String(draftEvent.draftYear),
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

  const updateDayEndRound = (index: number, value: string) => {
    const nextEndRound = Number(value);
    setDayRanges((current) => {
      const next = normalizeDayRanges(draftDatesInRange, totalRounds, current);
      if (!next[index]) return next;
      next[index] = { ...next[index], endRound: nextEndRound };
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
    !!startDateValue &&
    !!endDateValue &&
    !!totalRounds &&
    totalRounds > 1 &&
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
              Add Draft
            </Button>
          }
        >
          {draftEvents.length === 0 ? (
            <p className={styles.emptyMsg}>
              No drafts configured yet. Add draft dates so drafted player stints can use the
              correct start date.
            </p>
          ) : (
            <ul
              className={styles.awardDefinitionList}
              aria-label="Drafts"
            >
              {draftEvents.map((item) => (
                <li
                  key={item.draftYear}
                  className={styles.awardDefinitionSortableItem}
                >
                  <div className={styles.awardDefinitionItem}>
                    <div className={styles.awardDefinitionHeader}>
                      <div className={styles.awardDefinitionMain}>
                        <span className={styles.awardDefinitionName}>
                          {item.draftYear} Draft
                        </span>
                        <span className={styles.awardDefinitionDescription}>
                          {formatDateRange(item.startDate, item.endDate)}
                        </span>
                      </div>
                      <div className={styles.awardDefinitionActions}>
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
                      </div>
                    </div>
                    <Divider
                      variant="horizontal"
                      className={styles.awardDefinitionDivider}
                    />
                    <div
                      className={styles.awardDefinitionMeta}
                      aria-label="Draft details"
                    >
                      <Tag
                        label={`${item.totalRounds} rounds`}
                        intent="info"
                      />
                      <Tag
                        label={`${item.dayCount} ${item.dayCount === 1 ? 'day' : 'days'}`}
                        intent="neutral"
                      />
                      {item.rows.map((row) => (
                        <Tag
                          key={row.id}
                          label={`${formatDate(row.draft_date)}: ${formatRoundRange(row)}`}
                          intent="neutral"
                        />
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Modal
        open={modalOpen}
        title={editTarget ? 'Edit Draft' : 'Add Draft'}
        onClose={closeModal}
        confirmForm="league-draft-form"
        confirmLabel={submitting ? 'Saving...' : editTarget ? 'Save Changes' : 'Add Draft'}
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
              name="draftYear"
              type="number"
              label="Draft Year"
              min={1900}
              max={2200}
              required
              disabled={submitting}
              rules={{
                required: 'Draft year is required',
                min: { value: 1900, message: 'Must be 1900 or later' },
                max: { value: 2200, message: 'Must be 2200 or earlier' },
                validate: (value) => Number.isInteger(Number(value)) || 'Must be a whole number',
              }}
            />
            <Field
              control={form.control}
              name="totalRounds"
              type="number"
              label="Total Rounds"
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
          </div>

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

          {dayRanges.length > 0 && (
            <div className={styles.draftDayList}>
              {dayRanges.map((day, index) => {
                const isLastDay = index === dayRanges.length - 1;
                const maxEndRound = totalRounds
                  ? totalRounds - (dayRanges.length - index - 1)
                  : day.endRound;
                const sliderMax = Math.max(day.startRound, maxEndRound);
                return (
                  <div
                    key={day.date}
                    className={styles.draftDayRow}
                  >
                    <div className={styles.draftDayHeader}>
                      <div className={styles.draftDayTitle}>
                        <span>Day {index + 1}</span>
                        <strong>{formatDate(day.date)}</strong>
                      </div>
                      <Tag
                        label={
                          day.startRound === day.endRound
                            ? `Round ${day.startRound}`
                            : `Rounds ${day.startRound}-${day.endRound}`
                        }
                        intent="info"
                      />
                    </div>
                    <Slider
                      label="Round Range"
                      min={day.startRound}
                      max={sliderMax}
                      step={1}
                      value={day.endRound}
                      disabled={isLastDay || day.startRound === sliderMax}
                      onChange={(value) => updateDayEndRound(index, String(value))}
                    />
                  </div>
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
