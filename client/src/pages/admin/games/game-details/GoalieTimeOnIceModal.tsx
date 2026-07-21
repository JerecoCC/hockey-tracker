import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { ControlledTimePickerField } from '@/components/form/ControlledFields';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import PlayerAvatar from '@jerecocc/tracker-ui/components/PlayerAvatar/PlayerAvatar';
import TeamLogo from '@jerecocc/tracker-ui/components/TeamLogo/TeamLogo';
import { type GameRecord } from '@/hooks/useGames';
import { type GoalieStatRecord, type UpdateGoalieStintData } from '@/hooks/useGameGoalieStats';
import { type GoalRecord } from '@/hooks/useGameGoals';
import styles from './GameDetailsPage.module.scss';
import {
  defaultStintToi,
  gameMaxToiSeconds,
  mmssToSeconds,
  secondsToMMSS,
} from './goalieTimeOnIce';

const fmt = (first: string | null, last: string | null) =>
  last ? `${first ? `${first.charAt(0)}. ` : ''}${last}` : '';

type ToiFormValues = { stints: Array<{ time_on_ice: string }> };

interface Props {
  open: boolean;
  game: GameRecord;
  goalieStats: GoalieStatRecord[];
  goals: GoalRecord[];
  onClose: () => void;
  updateGoalieStint: (
    stintId: string,
    data: UpdateGoalieStintData,
  ) => Promise<GoalieStatRecord[] | null>;
}

const GoalieTimeOnIceModal = ({
  open,
  game,
  goalieStats,
  goals,
  onClose,
  updateGoalieStint,
}: Props) => {
  const [submitting, setSubmitting] = useState(false);
  // Cap the picker at the game's full length (regulation + any overtime).
  const maxMinutes = Math.ceil(gameMaxToiSeconds(game, goals) / 60);

  // Flatten every goalie stint into a row with its display info and prefill.
  const rows = useMemo(
    () =>
      goalieStats.flatMap((stat) =>
        stat.stints.map((st, i) => {
          const team =
            stat.team_id === game.away_team.id
              ? game.away_team
              : stat.team_id === game.home_team.id
                ? game.home_team
                : null;
          return {
            id: st.id,
            original: st.time_on_ice,
            prefill: secondsToMMSS(
              st.time_on_ice != null ? st.time_on_ice : defaultStintToi(st, game),
            ),
            name: fmt(stat.goalie_first_name, stat.goalie_last_name),
            stintLabel: stat.stints.length > 1 ? `Stint ${i + 1}` : null,
            photo: stat.goalie_photo,
            initials:
              `${stat.goalie_first_name?.charAt(0) ?? ''}${stat.goalie_last_name?.charAt(0) ?? ''}`.trim() ||
              '?',
            teamLogo: stat.team_logo,
            teamLogoDark: team?.logo_dark,
            teamLogoLight: team?.logo_light,
            teamCode: stat.team_code,
            primaryColor: stat.team_primary_color,
            textColor: stat.team_text_color,
          };
        }),
      ),
    [goalieStats, game],
  );

  const formValues = useMemo<ToiFormValues>(
    () => ({ stints: rows.map((r) => ({ time_on_ice: r.prefill })) }),
    [rows],
  );

  const {
    control,
    reset,
    getValues,
    formState: { isDirty, isValid },
  } = useForm<ToiFormValues>({ defaultValues: formValues, mode: 'onChange' });
  const { fields } = useFieldArray({ control, name: 'stints' });

  useLayoutEffect(() => {
    if (open) reset(formValues);
  }, [open, formValues, reset]);

  const handleClose = useCallback(() => {
    reset(formValues);
    onClose();
  }, [formValues, onClose, reset]);

  const handleConfirm = async () => {
    const { stints } = getValues();
    setSubmitting(true);
    try {
      for (let i = 0; i < rows.length; i += 1) {
        const value = stints[i]?.time_on_ice ?? '';
        // Persist only rows the admin actually changed.
        if (value && value !== rows[i].prefill) {
          await updateGoalieStint(rows[i].id, { time_on_ice: mmssToSeconds(value) });
        }
      }
      handleClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Edit Time on Ice"
      onClose={handleClose}
      confirmLabel={submitting ? 'Saving…' : 'Save'}
      onConfirm={handleConfirm}
      confirmDisabled={submitting || !isDirty || !isValid}
      busy={submitting}
    >
      {fields.length === 0 ? (
        <p className={styles.noGoalsText}>No goalie stats recorded.</p>
      ) : (
        <table className={`${styles.periodsTable} ${styles.shotsEditTable}`}>
          <thead>
            <tr>
              <th className={styles.thTeam} />
              <th className={styles.thPeriod}>Time on Ice</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, i) => {
              const row = rows[i];
              if (!row) return null;
              return (
                <tr key={field.id}>
                  <td className={styles.tdTeam}>
                    <span className={styles.toiPlayerCell}>
                      <TeamLogo
                        logo={row.teamLogo}
                        logoDark={row.teamLogoDark}
                        logoLight={row.teamLogoLight}
                        code={row.teamCode}
                        primaryColor={row.primaryColor}
                        textColor={row.textColor}
                        size={24}
                        shape="square"
                      />
                      <PlayerAvatar
                        photo={row.photo}
                        initials={row.initials}
                        primaryColor={row.primaryColor}
                        textColor={row.textColor}
                        size={32}
                      />
                      <span className={styles.toiPlayerName}>
                        {row.name}
                        {row.stintLabel && (
                          <span className={styles.toiStintLabel}>{row.stintLabel}</span>
                        )}
                      </span>
                    </span>
                  </td>
                  <td className={styles.tdShotsInput}>
                    <ControlledTimePickerField
                      mode="duration"
                      maxDurationMinutes={maxMinutes}
                      control={control}
                      name={`stints.${i}.time_on_ice`}
                      disabled={submitting}
                      rules={{ required: 'Required' }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Modal>
  );
};

export default GoalieTimeOnIceModal;
