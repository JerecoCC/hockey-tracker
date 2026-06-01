import { useState, useEffect } from 'react';
import Button from '@/components/Button/Button';
import Modal from '@/components/Modal/Modal';
import PlayerAvatar from '@/components/PlayerAvatar/PlayerAvatar';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import { type GameRecord } from '@/hooks/useGames';
import { type GameRosterEntry } from '@/hooks/useGameRoster';
import {
  type GoalieStatRecord,
  type GoalieStintRecord,
  type UpdateGoalieStintData,
} from '@/hooks/useGameGoalieStats';
import styles from './GameDetailsPage.module.scss';
import fieldStyles from '@/components/Field/Field.module.scss';
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

const fmtStintWindow = (stint: GoalieStintRecord) => {
  const enter = `${PERIOD_LABEL[stint.entered_period] ?? stint.entered_period}${stint.entered_time ? ` ${stint.entered_time}` : ''}`;
  if (!stint.exited_period) return `${enter} →`;
  const exit = `${PERIOD_LABEL[stint.exited_period] ?? stint.exited_period}${stint.exited_time ? ` ${stint.exited_time}` : ''}`;
  return `${enter} → ${exit}`;
};

interface StintRow {
  id: string;
  shots_against: string;
  goals_against: string; // '' = no override (auto-derived)
}

interface GoalieEditRow {
  stat: GoalieStatRecord;
  rosterEntry: GameRosterEntry;
  stints: StintRow[];
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
  removeGoalieStint,
  removeGoalieStat,
}: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [rows, setRows] = useState<GoalieEditRow[]>([]);

  // Build per-goalie edit rows (one group per GoalieStatRecord, one StintRow per stint).
  useEffect(() => {
    if (!open) return;
    const allRoster = [...awayRoster, ...homeRoster];
    const built: GoalieEditRow[] = goalieStats
      .map((stat) => {
        const entry = allRoster.find((e) => e.player_id === stat.goalie_id);
        if (!entry) return null;
        return {
          stat,
          rosterEntry: entry,
          stints: (stat.stints ?? []).map((st) => ({
            id: st.id,
            shots_against: String(st.shots_against),
            // '' if no override stored (will not send goals_against on save)
            goals_against:
              st.goals_against_override != null ? String(st.goals_against_override) : '',
          })),
        };
      })
      .filter((r): r is GoalieEditRow => r !== null);
    setRows(built);
  }, [open, goalieStats, awayRoster, homeRoster]);

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
              stints: row.stints.map((st, si) =>
                si !== stintIdx ? st : { ...st, [field]: value.replace(/[^0-9]/g, '') },
              ),
            },
      ),
    );
  };

  const handleSave = async () => {
    setSubmitting(true);
    for (const row of rows) {
      for (const stintRow of row.stints) {
        const sa = parseInt(stintRow.shots_against, 10);
        const patch: UpdateGoalieStintData = {};
        if (!isNaN(sa)) patch.shots_against = sa;
        // '' means "clear override" → send null; number string → send the number
        if (stintRow.goals_against !== '') {
          const ga = parseInt(stintRow.goals_against, 10);
          patch.goals_against = isNaN(ga) ? null : ga;
        }
        if (Object.keys(patch).length > 0) {
          await updateGoalieStint(stintRow.id, patch);
        }
      }
    }
    setSubmitting(false);
    onClose();
  };

  const handleRemoveStint = async (stintId: string) => {
    setRemoving(stintId);
    await removeGoalieStint(stintId);
    setRemoving(null);
  };

  const handleRemoveGoalie = async (goalieId: string) => {
    setRemoving(goalieId);
    await removeGoalieStat(goalieId);
    setRemoving(null);
  };

  const busy = submitting || !!removing;

  return (
    <Modal
      open={open}
      title="Edit Goalie Stats"
      onClose={onClose}
      confirmLabel={submitting ? 'Saving…' : 'Save'}
      onConfirm={handleSave}
      confirmDisabled={busy}
      busy={submitting}
    >
      <div className={styles.shotsModalBody}>
        {rows.map((row, gi) => {
          const { stat, rosterEntry: goalie } = row;
          const isAway = goalie.team_id === game.away_team.id;
          const logo = isAway ? game.away_team.logo : game.home_team.logo;
          const code = isAway ? game.away_team.code : game.home_team.code;
          const primary = isAway ? game.away_team.primary_color : game.home_team.primary_color;
          const text = isAway ? game.away_team.text_color : game.home_team.text_color;
          return (
            <div key={stat.goalie_id}>
              {gi > 0 && <hr className={styles.goalieGroupDivider} />}
              {/* ── Goalie header row ── */}
              <div className={styles.shotsGoalieRow}>
                <span className={styles.goalieNameCell}>
                  <TeamLogo
                    logo={logo}
                    code={code}
                    primaryColor={primary}
                    textColor={text}
                    size={36}
                    shape="square"
                  />
                  <PlayerAvatar
                    photo={goalie.photo}
                    initials={goalie.last_name?.charAt(0) ?? '?'}
                    primaryColor={primary}
                    textColor={text}
                    size={32}
                  />
                  <div className={styles.goalInfo}>
                    {goalie.jersey_number != null && (
                      <span className={styles.goalAssists}>#{goalie.jersey_number}</span>
                    )}
                    <span className={styles.goalScorer}>
                      {fmt(goalie.first_name, goalie.last_name)}
                    </span>
                  </div>
                </span>
                <Button
                  variant="outlined"
                  intent="danger"
                  icon="delete"
                  size="sm"
                  tooltip="Remove all stints for this goalie"
                  disabled={busy}
                  onClick={() => handleRemoveGoalie(goalie.player_id)}
                />
              </div>

              {/* ── Per-stint rows ── */}
              <div className={styles.shotsGoalieHeader}>
                <span
                  className={styles.shotsGoalieColLabel}
                  style={{ flex: 1 }}
                >
                  Window
                </span>
                <div className={styles.shotsGoalieInputs}>
                  <span className={styles.shotsGoalieColLabel}>SA</span>
                  <span className={styles.shotsGoalieColLabel}>GA</span>
                </div>
                {/* Invisible placeholder so SA/GA labels align with their inputs */}
                <Button
                  aria-hidden
                  tabIndex={-1}
                  variant="outlined"
                  intent="danger"
                  icon="delete"
                  size="sm"
                  style={{ visibility: 'hidden' }}
                />
              </div>
              {row.stints.map((stintRow, si) => {
                const originalStint = (stat.stints ?? [])[si];
                return (
                  <div
                    key={stintRow.id}
                    className={styles.goalieStintRow}
                  >
                    <span className={styles.goalieStintInfo}>
                      {originalStint ? fmtStintWindow(originalStint) : '—'}
                    </span>
                    <div className={styles.goalieStintInputs}>
                      <label>
                        <input
                          className={fieldStyles.field}
                          type="number"
                          min={0}
                          placeholder="SA"
                          value={stintRow.shots_against}
                          disabled={busy}
                          onChange={(e) => setStintField(gi, si, 'shots_against', e.target.value)}
                        />
                      </label>
                      <label title="GA override (blank = auto)">
                        <input
                          className={fieldStyles.field}
                          type="number"
                          min={0}
                          placeholder="auto"
                          value={stintRow.goals_against}
                          disabled={busy}
                          onChange={(e) => setStintField(gi, si, 'goals_against', e.target.value)}
                        />
                      </label>
                    </div>
                    <Button
                      variant="outlined"
                      intent="danger"
                      icon="delete"
                      size="sm"
                      tooltip="Remove this stint"
                      disabled={busy}
                      onClick={() => handleRemoveStint(stintRow.id)}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </Modal>
  );
};

export default GoalieStatsEditModal;
