import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/Button/Button';
import Modal from '@/components/Modal/Modal';
import PlayerAvatar from '@/components/PlayerAvatar/PlayerAvatar';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
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

const fmt = (first: string | null, last: string | null) =>
  last ? `${first ? `${first.charAt(0)}. ` : ''}${last}` : '';

const PERIOD_LABEL: Record<string, string> = {
  [PERIOD.FIRST]: 'P1',
  [PERIOD.SECOND]: 'P2',
  [PERIOD.THIRD]: 'P3',
  [PERIOD.OVERTIME]: PERIOD.OVERTIME,
  [PERIOD.SHOOTOUT]: PERIOD.SHOOTOUT,
};

const fmtStintPoint = (period: string, time: string | null) =>
  `${PERIOD_LABEL[period] ?? period}${time ? ` ${time}` : ''}`;

const fmtStintWindow = (stint?: GoalieStintRecord) => {
  if (!stint) return 'Auto window';
  const enter = fmtStintPoint(stint.entered_period, stint.entered_time);
  if (!stint.exited_period) return `${enter} to End`;
  return `${enter} to ${fmtStintPoint(stint.exited_period, stint.exited_time)}`;
};

const numericString = (value: string) => value.replace(/[^0-9]/g, '');

const parseNumber = (value: string) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

interface StintRow {
  id: string;
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
  const [rows, setRows] = useState<GoalieEditRow[]>([]);
  const [addDraft, setAddDraft] = useState<AddStintDraft>(() => ({
    team_id: '',
    goalie_id: '',
    entered_period: PERIOD.FIRST,
    entered_time: '',
    exited_period: '',
    exited_time: '',
    shots_against: '0',
    goals_against: '',
  }));

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
            shots_against: String(stint.shots_against),
            goals_against:
              stint.goals_against_override != null
                ? String(stint.goals_against_override)
                : '',
            base_saves: (stat.stints ?? []).length === 1 ? stat.saves : stint.saves,
          })),
        };
      })
      .filter((row): row is GoalieEditRow => row !== null);

    setRows(built);
    setAdding(false);
    setAddDraft({
      team_id: defaultTeamId,
      goalie_id: '',
      entered_period: PERIOD.FIRST,
      entered_time: '',
      exited_period: '',
      exited_time: '',
      shots_against: '0',
      goals_against: '',
    });
  }, [open, game.away_team.id, goalieStats, rosterByPlayerId]);

  const allGoalies = useMemo(
    () => [...awayRoster, ...homeRoster].filter((entry) => entry.position === 'G'),
    [awayRoster, homeRoster],
  );

  const addGoalieOptions = allGoalies.filter((goalie) => goalie.team_id === addDraft.team_id);

  const setAddDraftField = (field: keyof AddStintDraft, value: string) => {
    setAddDraft((prev) => {
      if (field === 'team_id') {
        return { ...prev, team_id: value, goalie_id: '' };
      }
      if (field === 'shots_against' || field === 'goals_against') {
        return { ...prev, [field]: numericString(value) };
      }
      return { ...prev, [field]: value };
    });
  };

  const setStintField = (
    goalieIdx: number,
    stintIdx: number,
    field: 'shots_against' | 'goals_against',
    value: string,
  ) => {
    setRows((prev) =>
      prev.map((row, gi) =>
        gi !== goalieIdx
          ? row
          : {
              ...row,
              stints: row.stints.map((stint, si) =>
                si === stintIdx ? { ...stint, [field]: numericString(value) } : stint,
              ),
            },
      ),
    );
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
        shots !== originalStint.shots_against ||
        override !== originalStint.goals_against_override
      );
    }),
  );

  const handleSave = async () => {
    setSubmitting(true);
    try {
      for (const row of rows) {
        for (let index = 0; index < row.stints.length; index += 1) {
          const stintRow = row.stints[index];
          const originalStint = row.stat.stints?.[index];
          if (!originalStint) continue;

          const patch: UpdateGoalieStintData = {};
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

  const handleAddStint = async () => {
    if (!addDraft.team_id || !addDraft.goalie_id || !addDraft.entered_period) return;
    setSubmitting(true);
    try {
      const rows = await addGoalieStint({
        team_id: addDraft.team_id,
        goalie_id: addDraft.goalie_id,
        entered_period: addDraft.entered_period,
        entered_time: addDraft.entered_time || null,
        exited_period: addDraft.exited_period || null,
        exited_time: addDraft.exited_time || null,
        shots_against: parseNumber(addDraft.shots_against),
        goals_against:
          addDraft.goals_against === '' ? null : parseNumber(addDraft.goals_against),
      });
      if (rows) {
        setAdding(false);
        setAddDraft((prev) => ({
          ...prev,
          goalie_id: '',
          entered_period: PERIOD.FIRST,
          entered_time: '',
          exited_period: '',
          exited_time: '',
          shots_against: '0',
          goals_against: '',
        }));
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
      confirmDisabled={busy || !hasChanges}
      busy={submitting}
      size="lg"
    >
      <div className={styles.goalieStatsEditor}>
        <div className={styles.goalieStatsEditorActions}>
          {adding ? (
            <div className={styles.goalieStatsEditorAddPanel}>
              <label>
                <span>Team</span>
                <select
                  className={fieldStyles.field}
                  value={addDraft.team_id}
                  disabled={busy}
                  onChange={(e) => setAddDraftField('team_id', e.target.value)}
                >
                  <option value={game.away_team.id}>{game.away_team.code}</option>
                  <option value={game.home_team.id}>{game.home_team.code}</option>
                </select>
              </label>
              <label>
                <span>Goalie</span>
                <select
                  className={fieldStyles.field}
                  value={addDraft.goalie_id}
                  disabled={busy}
                  onChange={(e) => setAddDraftField('goalie_id', e.target.value)}
                >
                  <option value="">Select goalie</option>
                  {addGoalieOptions.map((goalie) => (
                    <option
                      key={goalie.player_id}
                      value={goalie.player_id}
                    >
                      {fmt(goalie.first_name, goalie.last_name)}
                      {goalie.jersey_number != null ? ` #${goalie.jersey_number}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Enter</span>
                <select
                  className={fieldStyles.field}
                  value={addDraft.entered_period}
                  disabled={busy}
                  onChange={(e) => setAddDraftField('entered_period', e.target.value)}
                >
                  {Object.entries(PERIOD_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Time</span>
                <input
                  className={fieldStyles.field}
                  value={addDraft.entered_time}
                  placeholder="00:00"
                  disabled={busy}
                  onChange={(e) => setAddDraftField('entered_time', e.target.value)}
                />
              </label>
              <label>
                <span>Exit</span>
                <select
                  className={fieldStyles.field}
                  value={addDraft.exited_period}
                  disabled={busy}
                  onChange={(e) => setAddDraftField('exited_period', e.target.value)}
                >
                  <option value="">End</option>
                  {Object.entries(PERIOD_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Time</span>
                <input
                  className={fieldStyles.field}
                  value={addDraft.exited_time}
                  placeholder="00:00"
                  disabled={busy || !addDraft.exited_period}
                  onChange={(e) => setAddDraftField('exited_time', e.target.value)}
                />
              </label>
              <label>
                <span>SA</span>
                <input
                  className={fieldStyles.field}
                  type="number"
                  min={0}
                  value={addDraft.shots_against}
                  disabled={busy}
                  onChange={(e) => setAddDraftField('shots_against', e.target.value)}
                />
              </label>
              <label>
                <span>GA override</span>
                <input
                  className={fieldStyles.field}
                  type="number"
                  min={0}
                  placeholder="Auto"
                  value={addDraft.goals_against}
                  disabled={busy}
                  onChange={(e) => setAddDraftField('goals_against', e.target.value)}
                />
              </label>
              <div className={styles.goalieStatsEditorAddButtons}>
                <Button
                  variant="filled"
                  intent="accent"
                  icon="add"
                  size="sm"
                  disabled={busy || !addDraft.goalie_id}
                  onClick={handleAddStint}
                >
                  Add
                </Button>
                <Button
                  variant="ghost"
                  intent="neutral"
                  size="sm"
                  disabled={busy}
                  onClick={() => setAdding(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outlined"
              intent="neutral"
              icon="add"
              size="sm"
              disabled={busy}
              onClick={() => setAdding(true)}
            >
              Add stint
            </Button>
          )}
        </div>

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
          const canRemoveGoalie = teamGoalieCount > 1;

          return (
            <section
              key={stat.goalie_id}
              className={styles.goalieStatsEditorGroup}
            >
              <div className={styles.goalieStatsEditorHeader}>
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
                    <span className={styles.goalScorer}>{goalieName}</span>
                  </div>
                </span>

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
                  {canRemoveGoalie && (
                    <Button
                      variant="outlined"
                      intent="danger"
                      icon="delete"
                      size="sm"
                      tooltip="Remove all stints for this goalie"
                      disabled={busy}
                      onClick={() => handleRemoveGoalie(goalie.player_id)}
                    />
                  )}
                </div>
              </div>

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
                  const originalStint = stat.stints?.[stintIdx];
                  const ga = resolvedGa(stintRow, originalStint);

                  return (
                    <div
                      key={stintRow.id}
                      className={styles.goalieStatsEditorStint}
                    >
                      <span className={styles.goalieStintInfo}>
                        {fmtStintWindow(originalStint)}
                      </span>
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
                      <label>
                        <input
                          className={fieldStyles.field}
                          type="number"
                          min={0}
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
                      {row.stints.length > 1 && (
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

                {row.stints.length === 0 && (
                  <p className={styles.noGoalsText}>No stints for this goalie.</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </Modal>
  );
};

export default GoalieStatsEditModal;
