import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import Accordion from '@/components/Accordion/Accordion';
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
import { PERIOD } from './constants';
import { compareGoalieStats } from './goalieStatsOrdering';

const fmt = (first: string | null, last: string | null) =>
  last ? `${first ? `${first.charAt(0)}. ` : ''}${last}` : '';

const PERIOD_LABEL: Record<string, string> = {
  [PERIOD.FIRST]: 'P1',
  [PERIOD.SECOND]: 'P2',
  [PERIOD.THIRD]: 'P3',
  [PERIOD.OVERTIME]: PERIOD.OVERTIME,
  [PERIOD.SHOOTOUT]: PERIOD.SHOOTOUT,
};

const PERIOD_OPTIONS = Object.entries(PERIOD_LABEL).map(([value, label]) => ({ value, label }));

const numericString = (value: string) => value.replace(/[^0-9]/g, '');

const parseNumber = (value: string) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isStartingWindow = (period: string, time?: string | null) =>
  period === PERIOD.FIRST && (!time || time === '00:00');

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
  stintDraft: AddStintDraft;
}

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
  const [removing, setRemoving] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingStintFor, setAddingStintFor] = useState<string | null>(null);
  const {
    reset,
    getValues,
    setValue,
    watch,
    formState: { isDirty, isValid },
  } = useForm<GoalieStatsFormValues>({
    defaultValues: {
      rows: [],
      addDraft: defaultStintDraft(),
      stintDraft: defaultStintDraft(),
    },
    mode: 'onChange',
  });
  const rows = watch('rows') ?? [];
  const addDraft = watch('addDraft') ?? defaultStintDraft();
  const stintDraft = watch('stintDraft') ?? defaultStintDraft();

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
              stint.goals_against_override != null
                ? String(stint.goals_against_override)
                : '',
            base_saves: (stat.stints ?? []).length === 1 ? stat.saves : stint.saves,
          })),
        };
      })
      .filter((row): row is GoalieEditRow => row !== null)
      .sort(
        (a, b) =>
          compareGoalieStats(
            a.stat,
            a.rosterEntry,
            b.stat,
            b.rosterEntry,
            game.away_team.id,
          ),
      );

    setAdding(false);
    setAddingStintFor(null);
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
      stintDraft: defaultStintDraft(),
    });
  }, [open, game.away_team.id, goalieStats, rosterByPlayerId, reset, allGoalies]);

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
      code: game.away_team.code,
    },
    {
      value: game.home_team.id,
      label: `${game.home_team.code} (Home)`,
      logo: game.home_team.logo,
      code: game.home_team.code,
    },
  ];

  const goalieOptions = addGoalieOptions.map((goalie) => ({
    value: goalie.player_id,
    label: `${goalie.first_name} ${goalie.last_name}${
      goalie.jersey_number != null ? ` (#${goalie.jersey_number})` : ''
    }`,
  }));

  const addPreviewGa =
    stintDraft.goals_against === '' ? 'Auto' : parseNumber(stintDraft.goals_against);
  const addPreviewSv =
    stintDraft.goals_against === ''
      ? '-'
      : Math.max(0, parseNumber(stintDraft.shots_against) - parseNumber(stintDraft.goals_against));

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

  const setStintDraftField = (field: keyof AddStintDraft, value: string) => {
    const nextValue =
      field === 'shots_against' || field === 'goals_against' ? numericString(value) : value;
    setValue(
      'stintDraft',
      { ...getValues('stintDraft'), [field]: nextValue },
      { shouldDirty: true, shouldValidate: true },
    );
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
    return Math.max(0, parseNumber(stintRow.goals_against) - ownGoalAgainst(stintRow, originalStint));
  };

  const stintSaves = (stintRow: StintRow, originalStint?: GoalieStintRecord) =>
    Math.max(0, parseNumber(stintRow.shots_against) - saveGoalsAgainst(stintRow, originalStint));

  const rowTotals = (row: GoalieEditRow) =>
    row.stints.reduce(
      (totals, stintRow, index) => {
        const originalStint = row.stat.stints?.[index];
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

  const hasChanges = rows.some((row) =>
    row.stints.some((stintRow, index) => {
      const originalStint = row.stat.stints?.[index];
      if (!originalStint) return false;
      const shots = parseNumber(stintRow.shots_against);
      const override =
        stintRow.goals_against === '' ? null : parseNumber(stintRow.goals_against);
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

  const handleSave = async () => {
    setSubmitting(true);
    try {
      for (const row of getValues('rows')) {
        for (let index = 0; index < row.stints.length; index += 1) {
          const stintRow = row.stints[index];
          const originalStint = row.stat.stints?.[index];
          if (!originalStint) continue;

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
            await updateGoalieStint(stintRow.id, patch);
          }
        }
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveStint = async (stintId: string) => {
    setRemoving(stintId);
    try {
      await removeGoalieStint(stintId);
    } finally {
      setRemoving(null);
    }
  };

  const handleRemoveGoalie = async (goalieId: string) => {
    setRemoving(goalieId);
    try {
      await removeGoalieStat(goalieId);
    } finally {
      setRemoving(null);
    }
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

  const openAddStintForGoalie = (row: GoalieEditRow) => {
    setAddingStintFor(row.rosterEntry.player_id);
    setValue('stintDraft', defaultStintDraft(row.rosterEntry.team_id, row.rosterEntry.player_id), {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleAddGoalie = () => {
    const goalie = addGoalieOptions.find((entry) => entry.player_id === addDraft.goalie_id);
    if (!goalie) return;
    const currentRows = getValues('rows');
    const nextRows = currentRows.some((row) => row.rosterEntry.player_id === goalie.player_id)
      ? currentRows
      : [...currentRows, buildEmptyGoalieRow(goalie)].sort((a, b) =>
          compareGoalieStats(
            a.stat,
            a.rosterEntry,
            b.stat,
            b.rosterEntry,
            game.away_team.id,
          ),
        );
    setValue('rows', nextRows, { shouldDirty: true, shouldValidate: true });
    setAdding(false);
    setAddingStintFor(goalie.player_id);
    setValue('stintDraft', defaultStintDraft(goalie.team_id, goalie.player_id), {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue(
      'addDraft',
      { ...getValues('addDraft'), goalie_id: '' },
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const handleAddStint = async () => {
    if (!stintDraft.team_id || !stintDraft.goalie_id || !stintDraft.entered_period) return;
    setSubmitting(true);
    try {
      const rows = await addGoalieStint({
        team_id: stintDraft.team_id,
        goalie_id: stintDraft.goalie_id,
        entered_period: stintDraft.entered_period,
        entered_time: stintDraft.entered_time || null,
        exited_period: stintDraft.exited_period || null,
        exited_time: stintDraft.exited_time || null,
        shots_against: parseNumber(stintDraft.shots_against),
        goals_against:
          stintDraft.goals_against === '' ? null : parseNumber(stintDraft.goals_against),
      });
      if (rows) {
        setAddingStintFor(null);
        setValue('stintDraft', defaultStintDraft(), {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || !!removing;

  return (
    <Modal
      open={open}
      title="Edit Goalie Stats"
      onClose={onClose}
      confirmLabel={submitting ? 'Saving...' : 'Save'}
      onConfirm={handleSave}
      confirmDisabled={busy || !hasChanges || !isDirty || !isValid}
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
        {rows.length === 0 && (
          <p className={styles.noGoalsText}>No goalie stints recorded.</p>
        )}

        {rows.map((row, goalieIdx) => {
          const { stat, rosterEntry: goalie } = row;
          const isAway = goalie.team_id === game.away_team.id;
          const logo = isAway ? game.away_team.logo : game.home_team.logo;
          const code = isAway ? game.away_team.code : game.home_team.code;
          const primary = isAway ? game.away_team.primary_color : game.home_team.primary_color;
          const text = isAway ? game.away_team.text_color : game.home_team.text_color;
          const totals = rowTotals(row);
          const goalieName = fmt(goalie.first_name, goalie.last_name);
          const teamGoalieCount = rows.filter(
            ({ rosterEntry }) => rosterEntry.team_id === goalie.team_id,
          ).length;
          const goalieHasStarterStint = row.stints.some((stint) =>
            isStartingWindow(stint.entered_period, stint.entered_time),
          );
          const canRemoveGoalie = teamGoalieCount > 1 && !goalieHasStarterStint;

          return (
            <Accordion
              key={stat.goalie_id}
              variant="static"
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
                    size={34}
                  />
                  <div className={styles.goalInfo}>
                    {goalie.jersey_number != null && (
                      <span className={styles.goalAssists}>#{goalie.jersey_number}</span>
                    )}
                    <span className={`${styles.goalScorer} ${styles.goalieStatsEditorNameLine}`}>
                      <span className={styles.goalieStatsEditorPlayerName}>{goalieName}</span>
                    </span>
                  </div>
                </span>
              }
              labelMeta={
                <div className={styles.goalieStatsEditorTotals}>
                  <span className={styles.goalieStatsEditorTotalPill}>
                    <b>{totals.shots}</b>
                    SA
                  </span>
                  <span className={styles.goalieStatsEditorTotalPill}>
                    <b>{totals.saves}</b>
                    SV
                  </span>
                  <span className={styles.goalieStatsEditorTotalPill}>
                    <b>{totals.goals}</b>
                    GA
                  </span>
                </div>
              }
              hoverActions={[
                {
                  icon: 'add',
                  tooltip: 'Add stint for this goalie',
                  disabled: busy,
                  onClick: () => openAddStintForGoalie(row),
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

                {addingStintFor === goalie.player_id && (
                  <div className={styles.goalieStatsEditorStint}>
                    <div className={styles.goalieStatsEditorWindowFields}>
                      <div className={styles.goalieStatsEditorWindowRow}>
                        <div className={styles.goalieStatsEditorAddField}>
                          <span>Enter</span>
                          <Select
                            value={stintDraft.entered_period}
                            options={PERIOD_OPTIONS}
                            disabled={busy}
                            onChange={(value) => setStintDraftField('entered_period', value)}
                          />
                        </div>
                        <div className={styles.goalieStatsEditorAddField}>
                          <span>Time</span>
                          <TimePicker
                            value={stintDraft.entered_time}
                            placeholder="MM:SS"
                            mode="duration"
                            disabled={busy}
                            onChange={(value) => setStintDraftField('entered_time', value)}
                          />
                        </div>
                      </div>
                      <div className={styles.goalieStatsEditorWindowRow}>
                        <div className={styles.goalieStatsEditorAddField}>
                          <span>Exit</span>
                          <Select
                            value={stintDraft.exited_period}
                            options={[{ value: '', label: 'End' }, ...PERIOD_OPTIONS]}
                            disabled={busy}
                            onChange={(value) => setStintDraftField('exited_period', value)}
                          />
                        </div>
                        <div className={styles.goalieStatsEditorAddField}>
                          <span>Time</span>
                          <TimePicker
                            value={stintDraft.exited_time}
                            placeholder="MM:SS"
                            mode="duration"
                            disabled={busy || !stintDraft.exited_period}
                            onChange={(value) => setStintDraftField('exited_time', value)}
                          />
                        </div>
                      </div>
                    </div>
                    <label>
                      <input
                        className={fieldStyles.field}
                        type="number"
                        min={0}
                        aria-label={`${goalieName} new stint shots against`}
                        value={stintDraft.shots_against}
                        disabled={busy}
                        onChange={(e) => setStintDraftField('shots_against', e.target.value)}
                      />
                    </label>
                    <label className={styles.goalieStatsEditorGaOverrideField}>
                      <input
                        className={fieldStyles.field}
                        type="text"
                        inputMode="numeric"
                        placeholder="Auto"
                        aria-label={`${goalieName} new stint goals against override`}
                        value={stintDraft.goals_against}
                        disabled={busy}
                        onChange={(e) => setStintDraftField('goals_against', e.target.value)}
                      />
                    </label>
                    <span className={styles.goalieStatsEditorValue}>{addPreviewGa}</span>
                    <span className={styles.goalieStatsEditorValue}>{addPreviewSv}</span>
                    <div className={styles.goalieStatsEditorAddButtons}>
                      <Button
                        variant="filled"
                        intent="accent"
                        icon="add"
                        size="sm"
                        tooltip="Add stint"
                        disabled={busy}
                        onClick={handleAddStint}
                      />
                      <Button
                        variant="ghost"
                        intent="neutral"
                        icon="close"
                        size="sm"
                        tooltip="Cancel"
                        disabled={busy}
                        onClick={() => setAddingStintFor(null)}
                      />
                    </div>
                  </div>
                )}

                {row.stints.map((stintRow, stintIdx) => {
                  const originalStint = stat.stints?.[stintIdx];
                  const ga = resolvedGa(stintRow, originalStint);
                  const isStarter = isStartingWindow(
                    stintRow.entered_period,
                    stintRow.entered_time,
                  );

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
                              options={PERIOD_OPTIONS}
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
                              options={[{ value: '', label: 'End' }, ...PERIOD_OPTIONS]}
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
                      {row.stints.length > 1 && !isStarter && (
                        <Button
                          variant="ghost"
                          intent="danger"
                          icon="delete"
                          size="sm"
                          tooltip="Remove this stint"
                          disabled={busy}
                          onClick={() => handleRemoveStint(stintRow.id)}
                        />
                      )}
                    </div>
                  );
                })}

                {row.stints.length === 0 && addingStintFor !== goalie.player_id && (
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
                  size="sm"
                  tooltip="Add goalie"
                  disabled={busy || !addDraft.goalie_id}
                  onClick={handleAddGoalie}
                />
                <Button
                  variant="ghost"
                  intent="neutral"
                  icon="close"
                  size="sm"
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
