import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import Field from '@/components/Field/Field';
import Button from '@/components/Button/Button';
import Modal from '@/components/Modal/Modal';
import { type GameRecord } from '@/hooks/useGames';
import { type GameRosterEntry } from '@/hooks/useGameRoster';
import { type GoalieStatRecord, type UpsertGoalieStatData } from '@/hooks/useGameGoalieStats';
import { type LineupEntry } from '@/hooks/useGameLineup';
import styles from './GameDetailsPage.module.scss';

const fmt = (first: string | null, last: string | null) =>
  last ? `${first ? `${first.charAt(0)}. ` : ''}${last}` : '';

const PERIOD_OPTIONS = [
  { value: '', label: '— None —' },
  { value: '1', label: '1st Period' },
  { value: '2', label: '2nd Period' },
  { value: '3', label: '3rd Period' },
  { value: 'OT', label: 'Overtime' },
];

type FormValues = {
  goalies: Array<{ shots_against: string; entered_period: string; sub_time: string }>;
};

interface Props {
  open: boolean;
  game: GameRecord;
  awayRoster: GameRosterEntry[];
  homeRoster: GameRosterEntry[];
  goalieStats: GoalieStatRecord[];
  lineup: LineupEntry[];
  onClose: () => void;
  upsertGoalieStat: (data: UpsertGoalieStatData) => Promise<void>;
  removeGoalieStat: (goalieId: string) => Promise<boolean>;
}

const GoalieStatsEditModal = ({
  open,
  game,
  awayRoster,
  homeRoster,
  goalieStats,
  lineup,
  onClose,
  upsertGoalieStat,
  removeGoalieStat,
}: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  // Only show goalies that have a stat entry (both starters and backup entries).
  const allGoalies = [...awayRoster, ...homeRoster].filter((e) =>
    goalieStats.some((gs) => gs.goalie_id === e.player_id),
  );

  const { control, reset, getValues } = useForm<FormValues>({ defaultValues: { goalies: [] } });
  const { fields } = useFieldArray({ control, name: 'goalies' });

  useEffect(() => {
    if (open) {
      reset({
        goalies: allGoalies.map((g) => {
          const stat = goalieStats.find((gs) => gs.goalie_id === g.player_id);
          return {
            shots_against: stat ? String(stat.shots_against) : '',
            entered_period: stat?.entered_period ?? '',
            sub_time: stat?.sub_time ?? '',
          };
        }),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleConfirm = async () => {
    const { goalies } = getValues();
    setSubmitting(true);
    for (let i = 0; i < allGoalies.length; i++) {
      const goalie = allGoalies[i];
      const row = goalies[i];
      if (!row || !goalie) continue;
      const shots = parseInt(row.shots_against, 10);
      if (!isNaN(shots)) {
        const isStarter = lineup.some(
          (e) => e.player_id === goalie.player_id && e.position_slot === 'G',
        );
        await upsertGoalieStat({
          goalie_id: goalie.player_id,
          team_id: goalie.team_id,
          shots_against: shots,
          // Only send entered_period for non-starters (subs); starters leave it unchanged
          ...(!isStarter && {
            entered_period: row.entered_period || null,
            sub_time: row.sub_time || null,
          }),
        });
      }
    }
    setSubmitting(false);
    onClose();
  };

  const handleRemove = async (goalieId: string) => {
    setRemoving(goalieId);
    await removeGoalieStat(goalieId);
    setRemoving(null);
  };

  return (
    <Modal
      open={open}
      title="Edit Goalie Stats"
      onClose={onClose}
      confirmLabel={submitting ? 'Saving…' : 'Save'}
      onConfirm={handleConfirm}
      confirmDisabled={submitting || !!removing}
      busy={submitting}
    >
      <div className={styles.shotsModalBody}>
        <div className={styles.shotsGoalieHeader}>
          <span />
          <div className={styles.shotsGoalieInputs}>
            <span className={styles.shotsGoalieColLabel}>SA</span>
          </div>
          <span />
        </div>
        {fields.map((field, i) => {
          const goalie = allGoalies[i];
          if (!goalie) return null;
          const stat = goalieStats.find((gs) => gs.goalie_id === goalie.player_id);
          const isAway = goalie.team_id === game.away_team.id;
          const logo = isAway ? game.away_team.logo : game.home_team.logo;
          const code = isAway ? game.away_team.code : game.home_team.code;
          const primary = isAway ? game.away_team.primary_color : game.home_team.primary_color;
          const text = isAway ? game.away_team.text_color : game.home_team.text_color;
          const isStarter = lineup.some(
            (e) => e.player_id === goalie.player_id && e.position_slot === 'G',
          );
          const isBackup = !isStarter;
          return (
            <div key={field.id}>
              <div
                className={[styles.shotsGoalieRow, isStarter ? styles.shotsGoalieRowStarter : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className={styles.goalieNameCell}>
                  {logo ? (
                    <img
                      src={logo}
                      alt={code}
                      className={styles.goalTeamLogo}
                    />
                  ) : (
                    <span
                      className={styles.goalTeamLogoPlaceholder}
                      style={{ background: primary, color: text }}
                    >
                      {code?.slice(0, 1)}
                    </span>
                  )}
                  {goalie.photo ? (
                    <img
                      src={goalie.photo}
                      alt=""
                      className={styles.goalScorerPhoto}
                    />
                  ) : (
                    <span
                      className={styles.goalScorerPhotoPlaceholder}
                      style={{ background: primary, color: text }}
                    >
                      {goalie.last_name?.charAt(0)}
                    </span>
                  )}
                  <div className={styles.goalInfo}>
                    {goalie.jersey_number != null && (
                      <span className={styles.goalAssists}>#{goalie.jersey_number}</span>
                    )}
                    <span className={styles.goalScorer}>
                      {fmt(goalie.first_name, goalie.last_name)}
                    </span>
                  </div>
                </span>
                <div className={styles.shotsGoalieInputs}>
                  <Field
                    type="number"
                    control={control}
                    name={`goalies.${i}.shots_against`}
                    placeholder="0"
                    min={0}
                    disabled={submitting || !!removing}
                    transform={(v) => v.replace(/[^0-9]/g, '')}
                  />
                </div>
                {isBackup && (
                  <Button
                    variant="outlined"
                    intent="danger"
                    icon="delete"
                    size="sm"
                    tooltip="Remove goalie switch"
                    disabled={!!removing || submitting}
                    onClick={() => handleRemove(goalie.player_id)}
                  />
                )}
              </div>
              {isBackup && (
                <div className={styles.goalieSubRow}>
                  <Field
                    type="select"
                    control={control}
                    name={`goalies.${i}.entered_period`}
                    options={PERIOD_OPTIONS}
                    placeholder="— Period —"
                    disabled={submitting || !!removing}
                  />
                  <Field
                    type="timepicker"
                    mode="duration"
                    control={control}
                    name={`goalies.${i}.sub_time`}
                    placeholder="MM:SS"
                    disabled={submitting || !!removing}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
};

export default GoalieStatsEditModal;
