import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
import { type GameRecord } from '@/hooks/useGames';
import { type GameRosterEntry } from '@/hooks/useGameRoster';
import { type GoalieStatRecord } from '@/hooks/useGameGoalieStats';
import styles from './GameDetailsPage.module.scss';

const fmt = (first: string | null, last: string | null) =>
  last ? `${first ? `${first.charAt(0)}. ` : ''}${last}` : '';

type FormValues = { goalies: Array<{ shots_against: string; saves: string }> };

interface UpsertData {
  goalie_id: string;
  team_id: string;
  shots_against: number;
  saves: number;
}

interface Props {
  open: boolean;
  game: GameRecord;
  awayRoster: GameRosterEntry[];
  homeRoster: GameRosterEntry[];
  goalieStats: GoalieStatRecord[];
  onClose: () => void;
  upsertGoalieStat: (data: UpsertData) => Promise<void>;
}

const GoalieStatsEditModal = ({
  open,
  game,
  awayRoster,
  homeRoster,
  goalieStats,
  onClose,
  upsertGoalieStat,
}: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const allGoalies = [...awayRoster, ...homeRoster].filter((e) => e.position === 'G');

  const { control, reset, getValues } = useForm<FormValues>({ defaultValues: { goalies: [] } });
  const { fields } = useFieldArray({ control, name: 'goalies' });

  useEffect(() => {
    if (open) {
      reset({
        goalies: allGoalies.map((g) => {
          const stat = goalieStats.find((gs) => gs.goalie_id === g.player_id);
          return {
            shots_against: stat ? String(stat.shots_against) : '',
            saves: stat ? String(stat.saves) : '',
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
      const saves = parseInt(row.saves, 10);
      if (!isNaN(shots) && !isNaN(saves)) {
        await upsertGoalieStat({
          goalie_id: goalie.player_id,
          team_id: goalie.team_id,
          shots_against: shots,
          saves,
        });
      }
    }
    setSubmitting(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Goalie Stats"
      onClose={onClose}
      confirmLabel={submitting ? 'Saving…' : 'Save'}
      onConfirm={handleConfirm}
      confirmDisabled={submitting}
      busy={submitting}
    >
      <div className={styles.shotsModalBody}>
        <div className={styles.shotsGoalieHeader}>
          <span />
          <div className={styles.shotsGoalieInputs}>
            <span className={styles.shotsGoalieColLabel}>SA</span>
            <span className={styles.shotsGoalieColLabel}>SV</span>
          </div>
        </div>
        {fields.map((field, i) => {
          const goalie = allGoalies[i];
          if (!goalie) return null;
          const isAway = goalie.team_id === game.away_team_id;
          const logo = isAway ? game.away_team_logo : game.home_team_logo;
          const code = isAway ? game.away_team_code : game.home_team_code;
          const primary = isAway ? game.away_team_primary_color : game.home_team_primary_color;
          const text = isAway ? game.away_team_text_color : game.home_team_text_color;
          return (
            <div
              key={field.id}
              className={styles.shotsGoalieRow}
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
                  disabled={submitting}
                  transform={(v) => v.replace(/[^0-9]/g, '')}
                />
                <Field
                  type="number"
                  control={control}
                  name={`goalies.${i}.saves`}
                  placeholder="0"
                  min={0}
                  disabled={submitting}
                  transform={(v) => v.replace(/[^0-9]/g, '')}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
};

export default GoalieStatsEditModal;
