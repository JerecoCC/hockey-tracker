import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import Accordion from '@/components/Accordion/Accordion';
import Badge from '@/components/Badge/Badge';
import Button from '@/components/Button/Button';
import Modal from '@/components/Modal/Modal';
import PlayerAvatar from '@/components/PlayerAvatar/PlayerAvatar';
import Select from '@/components/Select/Select';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import TimePicker from '@/components/TimePicker/TimePicker';
import Tooltip from '@/components/Tooltip/Tooltip';
import { type GameRecord } from '@/hooks/useGames';
import { type GameRosterEntry } from '@/hooks/useGameRoster';
import {
  type GoalieSwitchData,
  type GoalieStatRecord,
  type GoalieStintRecord,
  type UpdateGoalieStintData,
} from '@/hooks/useGameGoalieStats';
import fieldStyles from '@/components/Field/Field.module.scss';
import styles from './GameDetailsPage.module.scss';
import { PERIOD, PERIOD_ORDER } from './constants';
import { compareGoalieStats } from './goalieStatsOrdering';

const fmt = (first: string | null, last: string | null) => [first, last].filter(Boolean).join(' ');

const jerseyChipLabel = (jerseyNumber: number | null) =>
  jerseyNumber == null ? null : String(jerseyNumber).replace(/\D/g, '').slice(0, 2);

const PERIOD_LABEL: Record<string, string> = {
  [PERIOD.FIRST]: 'P1',
  [PERIOD.SECOND]: 'P2',
  [PERIOD.THIRD]: 'P3',
  [PERIOD.OVERTIME]: PERIOD.OVERTIME,
  [PERIOD.SHOOTOUT]: PERIOD.SHOOTOUT,
};

const PERIOD_ORDER_VALUES: readonly string[] = PERIOD_ORDER;

const normalizeGamePeriodForStints = (period: string | null | undefined) => {
  if (!period) return null;
  const normalized = period.toUpperCase();
  if (/^OT\d+$/.test(normalized)) return PERIOD.OVERTIME;
  if (/^\d+$/.test(normalized) && Number(normalized) > 3) return PERIOD.OVERTIME;
  return normalized;
};

const periodSortValue = (period: string) => {
  const normalized = period.toUpperCase();
  const standardIndex = PERIOD_ORDER_VALUES.indexOf(normalized);
  if (standardIndex >= 0) return standardIndex;

  const overtimeMatch = /^OT(\d+)$/.exec(normalized);
  if (overtimeMatch) {
    return PERIOD_ORDER_VALUES.indexOf(PERIOD.OVERTIME) + Number(overtimeMatch[1]) / 100;
  }

  return Number.MAX_SAFE_INTEGER;
};

const sortPeriods = (periods: Iterable<string>) =>
  [...new Set([...periods].filter(Boolean))].sort(
    (a, b) => periodSortValue(a) - periodSortValue(b) || a.localeCompare(b),
  );

const periodOptionLabel = (period: string) => PERIOD_LABEL[period.toUpperCase()] ?? period;

const toPeriodOptions = (periods: Iterable<string>) =>
  sortPeriods(periods).map((period) => ({ value: period, label: periodOptionLabel(period) }));

const addPeriodsThrough = (periods: Set<string>, period: string | null | undefined) => {
  const normalized = normalizeGamePeriodForStints(period);
  const periodIndex = normalized ? PERIOD_ORDER_VALUES.indexOf(normalized) : -1;
  const thirdPeriodIndex = PERIOD_ORDER_VALUES.indexOf(PERIOD.THIRD);
  const lastRegulationIndex = periodIndex >= 0 ? Math.min(periodIndex, thirdPeriodIndex) : 0;

  for (let index = 0; index <= lastRegulationIndex; index += 1) {
    const periodId = PERIOD_ORDER_VALUES[index];
    if (periodId) periods.add(periodId);
  }

  if (normalized === PERIOD.OVERTIME || normalized === PERIOD.SHOOTOUT) {
    periods.add(PERIOD.OVERTIME);
  }
  if (normalized === PERIOD.SHOOTOUT) {
    periods.add(PERIOD.SHOOTOUT);
  }
};

const gamePlayedPeriods = (game: GameRecord) => {
  const periods = new Set<string>();

  if (game.status === 'final') {
    addPeriodsThrough(periods, PERIOD.THIRD);
  } else {
    addPeriodsThrough(periods, game.current_period ?? PERIOD.FIRST);
  }

  game.period_scores.forEach(({ period }) => addPeriodsThrough(periods, period));
  game.period_shots.forEach(({ period }) => addPeriodsThrough(periods, period));

  const hasShootout = game.shootout || game.current_period === PERIOD.SHOOTOUT;
  const hasOvertime =
    hasShootout ||
    (game.overtime_periods ?? 0) > 0 ||
    game.current_period === PERIOD.OVERTIME ||
    periods.has(PERIOD.SHOOTOUT) ||
    periods.has(PERIOD.OVERTIME);

  if (hasOvertime) periods.add(PERIOD.OVERTIME);
  if (hasShootout || periods.has(PERIOD.SHOOTOUT)) periods.add(PERIOD.SHOOTOUT);
  if (periods.size === 0) periods.add(PERIOD.FIRST);

  return sortPeriods(periods);
};

const numericString = (value: string) => value.replace(/[^0-9]/g, '');

const parseNumber = (value: string) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isStartingWindow = (period: string, time?: string | null) =>
  period === PERIOD.FIRST && (!time || time === '00:00');

const PENDING_ID_PREFIX = 'pending-';
const isPendingId = (id: string) => id.startsWith(PENDING_ID_PREFIX);

const defaultStintDraft = (teamId = '', goalieId = ''): AddStintDraft => ({
  team_id: teamId,
  goalie_id: goalieId,
  entered_period: PERIOD.FIRST,
  entered_time: '',
  exited_period: '',
  exited_time: '',
  shots_against: '0',
  goals_against: '',
});

interface StintRow {
  id: string;
  entered_period: string;
  entered_time: string;
  exited_period: string;
  exited_time: string;
  shots_against: string;
  goals_against: string;
  base_saves: number;
}

interface GoalieEditRow {
  stat: GoalieStatRecord;
  rosterEntry: GameRosterEntry;
  stints: StintRow[];
}

interface AddStintDraft {
  team_id: string;
  goalie_id: string;
  entered_period: string;
  entered_time: string;
  exited_period: string;
  exited_time: string;
  shots_against: string;
  goals_against: string;
}

interface GoalieStatsFormValues {
  rows: GoalieEditRow[];
  addDraft: AddStintDraft;
}

const lastStintForRow = (row: GoalieEditRow) => row.stints[row.stints.length - 1];

const addStintBlockReason = (row: GoalieEditRow) => {
  const incompleteExit = row.stints.find((stint) => !stint.exited_period || !stint.exited_time);
  if (!incompleteExit) return null;
  return incompleteExit.exited_period
    ? 'Set an exit time before adding another stint'
    : 'Set an exit period before adding another stint';
};

const EMPTY_ROWS: GoalieEditRow[] = [];

interface Props {
  open: boolean;
  game: GameRecord;
  awayRoster: GameRosterEntry[];
  homeRoster: GameRosterEntry[];
  goalieStats: GoalieStatRecord[];
  onClose: () => void;
  updateGoalieStint: (
    stintId: string,
    data: UpdateGoalieStintData,
  ) => Promise<GoalieStatRecord[] | null>;
  addGoalieStint: (data: GoalieSwitchData) => Promise<GoalieStatRecord[] | null>;
  removeGoalieStint: (stintId: string) => Promise<boolean>;
  removeGoalieStat: (goalieId: string) => Promise<boolean>;
}

const GoalieStatsEditModal = ({
  open,
  game,
  awayRoster,
  homeRoster,
  goalieStats,
  onClose,
  updateGoalieStint,
  addGoalieStint,
  removeGoalieStint,
  removeGoalieStat,
}: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removedGoalieIds, setRemovedGoalieIds] = useState<string[]>([]);
  const [removedStintIds, setRemovedStintIds] = useState<string[]>([]);
  const pendingStintIdRef = useRef(0);
  const {
    reset,
    getValues,
    setValue,
    watch,
    formState: { isValid },
  } = useForm<GoalieStatsFormValues>({
    defaultValues: {
      rows: [],
      addDraft: defaultStintDraft(),
    },
    mode: 'onChange',
  });
  const rows = watch('rows') ?? EMPTY_ROWS;
  const addDraft = watch('addDraft') ?? defaultStintDraft();

  const allGoalies = useMemo(
    () => [...awayRoster, ...homeRoster].filter((entry) => entry.position === 'G'),
    [awayRoster, homeRoster],
  );

  const rosterByPlayerId = useMemo(() => {
    const map = new Map<string, GameRosterEntry>();
    [...awayRoster, ...homeRoster].forEach((entry) => map.set(entry.player_id, entry));
    return map;
  }, [awayRoster, homeRoster]);

  useEffect(() => {
    if (!open) return;
    const defaultTeamId = game.away_team.id;

    const built: GoalieEditRow[] = goalieStats
      .map((stat) => {
        const entry = rosterByPlayerId.get(stat.goalie_id);
        if (!entry) return null;
        return {
          stat,
          rosterEntry: entry,
          stints: (stat.stints ?? []).map((stint) => ({
            id: stint.id,
            entered_period: stint.entered_period,
            entered_time: isStartingWindow(stint.entered_period, stint.entered_time)
              ? '00:00'
              : (stint.entered_time ?? ''),
            exited_period: stint.exited_period ?? '',
            exited_time: stint.exited_time ?? '',
            shots_against: String(stint.shots_against),
            goals_against:
              stint.goals_against_override != null ? String(stint.goals_against_override) : '',
            base_saves: (stat.stints ?? []).length === 1 ? stat.saves : stint.saves,
          })),
        };
      })
      .filter((row): row is GoalieEditRow => row !== null)
      .sort((a, b) =>
        compareGoalieStats(a.stat, a.rosterEntry, b.stat, b.rosterEntry, game.away_team.id),
      );

    setAdding(false);
    setRemovedGoalieIds([]);
    setRemovedStintIds([]);
    pendingStintIdRef.current = 0;
    reset({
      rows: built,
      addDraft: {
        team_id: defaultTeamId,
        goalie_id: '',
        entered_period: PERIOD.FIRST,
        entered_time: '',
        exited_period: '',
        exited_time: '',
        shots_against: '0',
        goals_against: '',
      },
    });
  }, [open, game.away_team.id, goalieStats, rosterByPlayerId, reset]);

  const addGoalieOptions = allGoalies.filter(
    (goalie) =>
      goalie.team_id === addDraft.team_id &&
      !rows.some((row) => row.rosterEntry.player_id === goalie.player_id),
  );
  const hasAvailableGoalies = allGoalies.some(
    (goalie) => !rows.some((row) => row.rosterEntry.player_id === goalie.player_id),
  );

  const teamOptions = [
    {
      value: game.away_team.id,
      label: `${game.away_team.code} (Away)`,
      logo: game.away_team.logo,
      logoDark: game.away_team.logo_dark,
      logoLight: game.away_team.logo_light,
      code: game.away_team.code,
    },
    {
      value: game.home_team.id,
      label: `${game.home_team.code} (Home)`,
      logo: game.home_team.logo,
      logoDark: game.home_team.logo_dark,
      logoLight: game.home_team.logo_light,
      code: game.home_team.code,
    },
  ];

  const goalieOptions = addGoalieOptions.map((goalie) => ({
    value: goalie.player_id,
    label: `${goalie.first_name} ${goalie.last_name}${
      goalie.jersey_number != null ? ` (#${goalie.jersey_number})` : ''
    }`,
  }));

  const periodOptions = useMemo(() => {
    const periods = new Set(gamePlayedPeriods(game));
    rows.forEach((row) =>
      row.stints.forEach((stint) => {
        if (stint.entered_period) periods.add(stint.entered_period);
        if (stint.exited_period) periods.add(stint.exited_period);
      }),
    );
    return toPeriodOptions(periods);
  }, [game, rows]);
  const exitPeriodOptions = useMemo(
    () => [{ value: '', label: 'End' }, ...periodOptions],
    [periodOptions],
  );
  const defaultEnteredPeriod = periodOptions[0]?.value ?? PERIOD.FIRST;

  const setAddDraftField = (field: keyof AddStintDraft, value: string) => {
    const prev = getValues('addDraft');
    const nextValue =
      field === 'shots_against' || field === 'goals_against' ? numericString(value) : value;
    const next =
      field === 'team_id'
        ? { ...prev, team_id: value, goalie_id: '' }
        : { ...prev, [field]: nextValue };
    setValue('addDraft', next, { shouldDirty: true, shouldValidate: true });
  };

  const setStintField = (
    goalieIdx: number,
    stintIdx: number,
    field:
      | 'entered_period'
      | 'entered_time'
      | 'exited_period'
      | 'exited_time'
      | 'shots_against'
      | 'goals_against',
    value: string,
  ) => {
    const nextValue =
      field === 'shots_against' || field === 'goals_against' ? numericString(value) : value;
    setValue(`rows.${goalieIdx}.stints.${stintIdx}.${field}`, nextValue, {
      shouldDirty: true,
      shouldValidate: true,
    });
    if (field === 'exited_period' && !value) {
      setValue(`rows.${goalieIdx}.stints.${stintIdx}.exited_time`, '', {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  };

  const resolvedGa = (stintRow: StintRow, originalStint?: GoalieStintRecord) =>
    stintRow.goals_against === ''
      ? (originalStint?.goals_against ?? 0)
      : parseNumber(stintRow.goals_against);

  const shotGoalsAgainst = (stintRow: StintRow, originalStint?: GoalieStintRecord) =>
    Math.max(0, (originalStint?.shots_against ?? 0) - stintRow.base_saves);

  const ownGoalAgainst = (stintRow: StintRow, originalStint?: GoalieStintRecord) =>
    Math.max(0, (originalStint?.goals_against ?? 0) - shotGoalsAgainst(stintRow, originalStint));

  const saveGoalsAgainst = (stintRow: StintRow, originalStint?: GoalieStintRecord) => {
    if (stintRow.goals_against === '') return shotGoalsAgainst(stintRow, originalStint);
    return Math.max(
      0,
      parseNumber(stintRow.goals_against) - ownGoalAgainst(stintRow, originalStint),
    );
  };

  const stintSaves = (stintRow: StintRow, originalStint?: GoalieStintRecord) =>
    Math.max(0, parseNumber(stintRow.shots_against) - saveGoalsAgainst(stintRow, originalStint));

  const originalStintForRow = (row: GoalieEditRow, stintRow: StintRow) =>
    isPendingId(stintRow.id)
      ? undefined
      : row.stat.stints?.find((stint) => stint.id === stintRow.id);

  const rowTotals = (row: GoalieEditRow) =>
    row.stints.reduce(
      (totals, stintRow) => {
        const originalStint = originalStintForRow(row, stintRow);
        const shots = parseNumber(stintRow.shots_against);
        const ga = resolvedGa(stintRow, originalStint);
        return {
          shots: totals.shots + shots,
          goals: totals.goals + ga,
          saves: totals.saves + stintSaves(stintRow, originalStint),
        };
      },
      { shots: 0, saves: 0, goals: 0 },
    );

  const hasChanges =
    removedGoalieIds.length > 0 ||
    removedStintIds.length > 0 ||
    rows.some((row) =>
      row.stints.some((stintRow) => {
        const originalStint = originalStintForRow(row, stintRow);
        if (!originalStint) return !!stintRow.entered_period;
        const shots = parseNumber(stintRow.shots_against);
        const override = stintRow.goals_against === '' ? null : parseNumber(stintRow.goals_against);
        return (
          stintRow.entered_period !== originalStint.entered_period ||
          (stintRow.entered_time || null) !== originalStint.entered_time ||
          (stintRow.exited_period || null) !== originalStint.exited_period ||
          (stintRow.exited_time || null) !== originalStint.exited_time ||
          shots !== originalStint.shots_against ||
          override !== originalStint.goals_against_override
        );
      }),
    );

  const buildGoalieSwitchData = (row: GoalieEditRow, stintRow: StintRow): GoalieSwitchData => ({
    team_id: row.rosterEntry.team_id,
    goalie_id: row.rosterEntry.player_id,
    entered_period: stintRow.entered_period,
    entered_time: stintRow.entered_time || null,
    exited_period: stintRow.exited_period || null,
    exited_time: stintRow.exited_time || null,
    shots_against: parseNumber(stintRow.shots_against),
    goals_against: stintRow.goals_against === '' ? null : parseNumber(stintRow.goals_against),
  });

  const handleSave = async () => {
    setSubmitting(true);
    try {
      for (const goalieId of removedGoalieIds) {
        const ok = await removeGoalieStat(goalieId);
        if (!ok) return;
      }

      for (const stintId of removedStintIds) {
        const ok = await removeGoalieStint(stintId);
        if (!ok) return;
      }

      for (const row of getValues('rows')) {
        for (let index = 0; index < row.stints.length; index += 1) {
          const stintRow = row.stints[index];
          const originalStint = originalStintForRow(row, stintRow);
          if (!originalStint) {
            const rows = await addGoalieStint(buildGoalieSwitchData(row, stintRow));
            if (!rows) return;
            continue;
          }

          const patch: UpdateGoalieStintData = {};
          if (stintRow.entered_period !== originalStint.entered_period) {
            patch.entered_period = stintRow.entered_period;
          }
          if ((stintRow.entered_time || null) !== originalStint.entered_time) {
            patch.entered_time = stintRow.entered_time || null;
          }
          if ((stintRow.exited_period || null) !== originalStint.exited_period) {
            patch.exited_period = stintRow.exited_period || null;
          }
          if ((stintRow.exited_time || null) !== originalStint.exited_time) {
            patch.exited_time = stintRow.exited_time || null;
          }
          const shots = parseNumber(stintRow.shots_against);
          if (shots !== originalStint.shots_against) patch.shots_against = shots;

          if (stintRow.goals_against === '') {
            if (originalStint.goals_against_override != null) patch.goals_against = null;
          } else {
            const goalsAgainst = parseNumber(stintRow.goals_against);
            if (goalsAgainst !== originalStint.goals_against_override) {
              patch.goals_against = goalsAgainst;
            }
          }

          if (Object.keys(patch).length > 0) {
            const rows = await updateGoalieStint(stintRow.id, patch);
            if (!rows) return;
          }
        }
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveStint = (goalieIdx: number, stintId: string) => {
    const currentRows = getValues('rows');
    const row = currentRows[goalieIdx];
    const stint = row?.stints.find((currentStint) => currentStint.id === stintId);
    if (!row || !stint) return;

    const nextStints = row.stints.filter((currentStint) => currentStint.id !== stintId);
    const nextRows =
      nextStints.length === 0 && isPendingId(row.stat.id)
        ? currentRows.filter((_, index) => index !== goalieIdx)
        : currentRows.map((currentRow, index) =>
            index === goalieIdx ? { ...currentRow, stints: nextStints } : currentRow,
          );

    setValue('rows', nextRows, { shouldDirty: true, shouldValidate: true });
    if (!isPendingId(stint.id)) {
      setRemovedStintIds((prev) => (prev.includes(stint.id) ? prev : [...prev, stint.id]));
    }
  };

  const handleRemoveGoalie = (goalieId: string) => {
    const currentRows = getValues('rows');
    const row = currentRows.find((currentRow) => currentRow.rosterEntry.player_id === goalieId);
    const removedIds = new Set(row?.stints.map((stint) => stint.id) ?? []);

    setValue(
      'rows',
      currentRows.filter((currentRow) => currentRow.rosterEntry.player_id !== goalieId),
      { shouldDirty: true, shouldValidate: true },
    );
    setRemovedStintIds((prev) => prev.filter((stintId) => !removedIds.has(stintId)));
    if (row && !isPendingId(row.stat.id)) {
      setRemovedGoalieIds((prev) => (prev.includes(goalieId) ? prev : [...prev, goalieId]));
    }
  };

  const buildPendingStintRow = (previousStint?: StintRow): StintRow => {
    pendingStintIdRef.current += 1;
    return {
      id: `${PENDING_ID_PREFIX}stint-${pendingStintIdRef.current}`,
      entered_period: previousStint?.exited_period || defaultEnteredPeriod,
      entered_time: previousStint?.exited_time || '',
      exited_period: '',
      exited_time: '',
      shots_against: '0',
      goals_against: '',
      base_saves: 0,
    };
  };

  const buildEmptyGoalieRow = (goalie: GameRosterEntry): GoalieEditRow => {
    const isAway = goalie.team_id === game.away_team.id;
    const team = isAway ? game.away_team : game.home_team;
    return {
      rosterEntry: goalie,
      stints: [],
      stat: {
        id: `pending-${goalie.player_id}`,
        game_id: game.id,
        team_id: goalie.team_id,
        goalie_id: goalie.player_id,
        shots_against: 0,
        goals_against: 0,
        saves: 0,
        entered_period: null,
        sub_time: null,
        created_at: '',
        stints: [],
        goalie_first_name: goalie.first_name ?? '',
        goalie_last_name: goalie.last_name ?? '',
        goalie_photo: goalie.photo,
        goalie_jersey_number: goalie.jersey_number,
        team_name: team.name,
        team_code: team.code,
        team_logo: team.logo,
        team_primary_color: team.primary_color,
        team_text_color: team.text_color,
      },
    };
  };

  const addPendingStintForGoalie = (row: GoalieEditRow) => {
    const currentRows = getValues('rows');
    const targetRow = currentRows.find(
      (currentRow) => currentRow.rosterEntry.player_id === row.rosterEntry.player_id,
    );
    if (!targetRow || addStintBlockReason(targetRow)) return;
    const lastStint = lastStintForRow(targetRow);

    const nextRows = currentRows.map((currentRow) =>
      currentRow.rosterEntry.player_id === row.rosterEntry.player_id
        ? { ...currentRow, stints: [...currentRow.stints, buildPendingStintRow(lastStint)] }
        : currentRow,
    );
    setValue('rows', nextRows, { shouldDirty: true, shouldValidate: true });
  };

  const handleAddGoalie = () => {
    const goalie = addGoalieOptions.find((entry) => entry.player_id === addDraft.goalie_id);
    if (!goalie) return;
    const currentRows = getValues('rows');
    const newGoalieRow = buildEmptyGoalieRow(goalie);
    const nextRows = currentRows.some((row) => row.rosterEntry.player_id === goalie.player_id)
      ? currentRows
      : [{ ...newGoalieRow, stints: [buildPendingStintRow()] }, ...currentRows].sort((a, b) =>
          compareGoalieStats(a.stat, a.rosterEntry, b.stat, b.rosterEntry, game.away_team.id),
        );
    setValue('rows', nextRows, { shouldDirty: true, shouldValidate: true });
    setAdding(false);
    setValue(
      'addDraft',
      { ...getValues('addDraft'), goalie_id: '' },
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const busy = submitting;

  return (
    <Modal
      open={open}
      title="Edit Goalie Stats"
      onClose={onClose}
      disableBackdropClose
      confirmLabel={submitting ? 'Saving...' : 'Save'}
      onConfirm={handleSave}
      confirmDisabled={busy || !hasChanges || !isValid}
      busy={submitting}
      size="lg"
      footerStart={
        hasAvailableGoalies ? (
          <Button
            variant="outlined"
            intent="neutral"
            icon="add"
            type="button"
            disabled={busy || adding}
            onClick={() => setAdding(true)}
          >
            Add goalie
          </Button>
        ) : null
      }
    >
      <div className={styles.goalieStatsEditor}>
        {rows.length === 0 && <p className={styles.noGoalsText}>No goalie stints recorded.</p>}

        {rows.map((row, goalieIdx) => {
          const { stat, rosterEntry: goalie } = row;
          const isAway = goalie.team_id === game.away_team.id;
          const logo = isAway ? game.away_team.logo : game.home_team.logo;
          const logoDark = isAway ? game.away_team.logo_dark : game.home_team.logo_dark;
          const logoLight = isAway ? game.away_team.logo_light : game.home_team.logo_light;
          const code = isAway ? game.away_team.code : game.home_team.code;
          const primary = isAway ? game.away_team.primary_color : game.home_team.primary_color;
          const text = isAway ? game.away_team.text_color : game.home_team.text_color;
          const totals = rowTotals(row);
          const goalieName = fmt(goalie.first_name, goalie.last_name);
          const jerseyLabel = jerseyChipLabel(goalie.jersey_number);
          const teamGoalieCount = rows.filter(
            ({ rosterEntry }) => rosterEntry.team_id === goalie.team_id,
          ).length;
          const goalieHasStarterStint = row.stints.some(
            (stint) =>
              !isPendingId(stint.id) && isStartingWindow(stint.entered_period, stint.entered_time),
          );
          const canRemoveGoalie = teamGoalieCount > 1 && !goalieHasStarterStint;
          const stintAddBlockReason = addStintBlockReason(row);

          return (
            <Accordion
              key={stat.goalie_id}
              variant="static"
              headerType="light"
              hoverRevealActions
              className={
                teamGoalieCount > 1 && goalieHasStarterStint
                  ? styles.goalieStatsEditorGroupMulti
                  : undefined
              }
              bodyClassName={styles.goalieStatsEditorBody}
              label={
                <span className={styles.goalieNameCell}>
                  <TeamLogo
                    logo={logo}
                    logoDark={logoDark}
                    logoLight={logoLight}
                    code={code}
                    primaryColor={primary}
                    textColor={text}
                    size={30}
                    shape="square"
                  />
                  <PlayerAvatar
                    photo={goalie.photo}
                    initials={goalie.last_name?.charAt(0) ?? '?'}
                    primaryColor={primary}
                    textColor={text}
                    size={30}
                  />
                  {jerseyLabel && (
                    <span
                      className={styles.goalieStatsEditorJerseyChip}
                      aria-label={`Jersey ${jerseyLabel}`}
                    >
                      {jerseyLabel}
                    </span>
                  )}
                  <span className={styles.goalieStatsEditorPlayerName}>{goalieName}</span>
                </span>
              }
              headerRight={
                <div className={styles.goalieStatsEditorTotals}>
                  <Badge
                    label="SA"
                    value={totals.shots}
                  />
                  <Badge
                    label="SV"
                    value={totals.saves}
                  />
                  <Badge
                    label="GA"
                    value={totals.goals}
                  />
                </div>
              }
              hoverActions={[
                {
                  icon: 'add',
                  intent: 'accent',
                  tooltip: stintAddBlockReason ?? 'Add stint for this goalie',
                  disabled: busy || !!stintAddBlockReason,
                  onClick: () => addPendingStintForGoalie(row),
                },
                ...(canRemoveGoalie
                  ? [
                      {
                        icon: 'delete',
                        intent: 'danger' as const,
                        tooltip: 'Remove all stints for this goalie',
                        disabled: busy,
                        onClick: () => handleRemoveGoalie(goalie.player_id),
                      },
                    ]
                  : []),
              ]}
            >
              <div className={styles.goalieStatsEditorTable}>
                <div className={styles.goalieStatsEditorHead}>
                  <span>Window</span>
                  <Tooltip text="Shots against">
                    <span>SA</span>
                  </Tooltip>
                  <Tooltip text="Optional goals-against override. Leave blank to use goals from scoring.">
                    <span>GA override</span>
                  </Tooltip>
                  <Tooltip text="Resolved goals against">
                    <span>GA</span>
                  </Tooltip>
                  <Tooltip text="Saves">
                    <span>SV</span>
                  </Tooltip>
                  <span />
                </div>

                {row.stints.map((stintRow, stintIdx) => {
                  const originalStint = originalStintForRow(row, stintRow);
                  const ga = resolvedGa(stintRow, originalStint);
                  const isStarter =
                    !!originalStint &&
                    isStartingWindow(stintRow.entered_period, stintRow.entered_time);

                  return (
                    <div
                      key={stintRow.id}
                      className={styles.goalieStatsEditorStint}
                    >
                      <div className={styles.goalieStatsEditorWindowFields}>
                        <div className={styles.goalieStatsEditorWindowRow}>
                          <div className={styles.goalieStatsEditorAddField}>
                            <span>Enter</span>
                            <Select
                              value={stintRow.entered_period}
                              options={periodOptions}
                              width="content"
                              disabled={busy || isStarter}
                              onChange={(value) =>
                                setStintField(goalieIdx, stintIdx, 'entered_period', value)
                              }
                            />
                          </div>
                          <div className={styles.goalieStatsEditorAddField}>
                            <span>Time</span>
                            <TimePicker
                              value={stintRow.entered_time}
                              placeholder="MM:SS"
                              mode="duration"
                              disabled={busy || isStarter}
                              onChange={(value) =>
                                setStintField(goalieIdx, stintIdx, 'entered_time', value)
                              }
                            />
                          </div>
                        </div>
                        <div className={styles.goalieStatsEditorWindowRow}>
                          <div className={styles.goalieStatsEditorAddField}>
                            <span>Exit</span>
                            <Select
                              value={stintRow.exited_period}
                              options={exitPeriodOptions}
                              width="content"
                              disabled={busy}
                              onChange={(value) =>
                                setStintField(goalieIdx, stintIdx, 'exited_period', value)
                              }
                            />
                          </div>
                          <div className={styles.goalieStatsEditorAddField}>
                            <span>Time</span>
                            <TimePicker
                              value={stintRow.exited_time}
                              placeholder="MM:SS"
                              mode="duration"
                              disabled={busy || !stintRow.exited_period}
                              onChange={(value) =>
                                setStintField(goalieIdx, stintIdx, 'exited_time', value)
                              }
                            />
                          </div>
                        </div>
                      </div>
                      <label>
                        <input
                          className={fieldStyles.field}
                          type="number"
                          min={0}
                          aria-label={`${goalieName} shots against`}
                          value={stintRow.shots_against}
                          disabled={busy}
                          onChange={(e) =>
                            setStintField(goalieIdx, stintIdx, 'shots_against', e.target.value)
                          }
                        />
                      </label>
                      <label className={styles.goalieStatsEditorGaOverrideField}>
                        <input
                          className={fieldStyles.field}
                          type="text"
                          inputMode="numeric"
                          placeholder="Auto"
                          aria-label={`${goalieName} goals against override`}
                          value={stintRow.goals_against}
                          disabled={busy}
                          onChange={(e) =>
                            setStintField(goalieIdx, stintIdx, 'goals_against', e.target.value)
                          }
                        />
                      </label>
                      <span className={styles.goalieStatsEditorValue}>{ga}</span>
                      <span className={styles.goalieStatsEditorValue}>
                        {stintSaves(stintRow, originalStint)}
                      </span>
                      <Button
                        variant="outlined"
                        intent="danger"
                        icon="delete"
                        tooltip={
                          isPendingId(stintRow.id) ? 'Discard this stint' : 'Remove this stint'
                        }
                        disabled={busy}
                        onClick={() => handleRemoveStint(goalieIdx, stintRow.id)}
                      />
                    </div>
                  );
                })}

                {row.stints.length === 0 && (
                  <p className={styles.noGoalsText}>No stints for this goalie.</p>
                )}
              </div>
            </Accordion>
          );
        })}

        {adding && (
          <div className={styles.goalieStatsEditorAddPanel}>
            <div className={styles.goalieStatsEditorAddHeader}>
              <div className={styles.goalieStatsEditorAddSelectors}>
                <div className={styles.goalieStatsEditorAddField}>
                  <span>Team</span>
                  <Select
                    value={addDraft.team_id}
                    options={teamOptions}
                    disabled={busy}
                    onChange={(value) => setAddDraftField('team_id', value)}
                  />
                </div>
                <div className={styles.goalieStatsEditorAddField}>
                  <span>Goalie</span>
                  <Select
                    value={addDraft.goalie_id || null}
                    options={goalieOptions}
                    placeholder="Select goalie"
                    searchable
                    disabled={busy}
                    onChange={(value) => setAddDraftField('goalie_id', value)}
                  />
                </div>
              </div>
              <div className={styles.goalieStatsEditorAddButtons}>
                <Button
                  variant="filled"
                  intent="accent"
                  icon="add"
                  tooltip="Add goalie"
                  disabled={busy || !addDraft.goalie_id}
                  onClick={handleAddGoalie}
                />
                <Button
                  variant="ghost"
                  intent="neutral"
                  icon="close"
                  tooltip="Cancel"
                  disabled={busy}
                  onClick={() => setAdding(false)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default GoalieStatsEditModal;
