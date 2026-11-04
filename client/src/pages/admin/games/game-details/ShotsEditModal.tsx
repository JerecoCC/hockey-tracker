import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { ControlledInputField } from '@/components/form/ControlledFields';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import TeamLogo from '@jerecocc/tracker-ui/components/TeamLogo/TeamLogo';
import useBackgroundModalAction from '@/hooks/useBackgroundModalAction';
import { type GameRecord } from '@/hooks/useGames';
import { type GameRosterEntry } from '@/hooks/useGameRoster';
import { type GoalieStatRecord, type UpsertGoalieStatData } from '@/hooks/useGameGoalieStats';
import { type GoalRecord } from '@/hooks/useGameGoals';
import { type LineupEntry } from '@/hooks/useGameLineup';
import { computeAutoSA } from './shotCalculations';
import styles from './GameDetailsPage.module.scss';

type ShotsEditFormValues = { periods: Array<{ away_shots: string; home_shots: string }> };

interface LinescorePeriod {
  id: string;
  label: string;
}

interface Props {
  open: boolean;
  game: GameRecord;
  periods: LinescorePeriod[];
  awayRoster: GameRosterEntry[];
  homeRoster: GameRosterEntry[];
  goalieStats: GoalieStatRecord[];
  goals: GoalRecord[];
  lineup: LineupEntry[];
  onClose: () => void;
  updatePeriodShots: (period: string, home: number, away: number) => Promise<boolean | undefined>;
  /** Resolves falsy when the goalie stat fails to save. */
  upsertGoalieStat: (data: UpsertGoalieStatData) => Promise<unknown>;
}

const ShotsEditModal = ({
  open,
  game,
  periods,
  awayRoster,
  homeRoster,
  goalieStats,
  goals,
  lineup,
  onClose,
  updatePeriodShots,
  upsertGoalieStat,
}: Props) => {
  // Set once the shots are submitted: the form then keeps what was entered until the modal
  // closes, even when a partly-saved edit refreshes the game, so a failed save reappears with it.
  const keepDraftRef = useRef(false);
  const formValues = useMemo<ShotsEditFormValues>(
    () => ({
      periods: periods.map((p) => {
        const ps = game.period_shots.find((s) => s.period === p.id);
        return {
          away_shots: ps ? String(ps.away_shots) : '',
          home_shots: ps ? String(ps.home_shots) : '',
        };
      }),
    }),
    [game.period_shots, periods],
  );
  const {
    control,
    reset,
    getValues,
    formState: { isDirty, isValid },
  } = useForm<ShotsEditFormValues>({
    defaultValues: formValues,
    mode: 'onChange',
  });
  const { fields } = useFieldArray({ control, name: 'periods' });

  useLayoutEffect(() => {
    if (!keepDraftRef.current) reset(formValues);
  }, [formValues, reset]);

  const handleClose = useCallback(() => {
    keepDraftRef.current = false;
    reset(formValues);
    onClose();
  }, [formValues, onClose, reset]);

  // The modal hides while the shots save behind a progress toast, and reappears with the shots
  // entered if any of them fail.
  const { hidden, runSettled } = useBackgroundModalAction({
    target: open ? game.id : null,
    onDone: () => {
      keepDraftRef.current = false;
      onClose();
    },
  });

  const saveShots = async () => {
    const { periods: rows } = getValues();

    // Build the complete merged period shots from form values.
    const mergedShots = periods.map((p, i) => {
      const row = rows[i];
      const away = parseInt(row?.away_shots || '0', 10);
      const home = parseInt(row?.home_shots || '0', 10);
      return {
        period: p.id,
        away_shots: isNaN(away) ? 0 : away,
        home_shots: isNaN(home) ? 0 : home,
      };
    });

    // Save all period shots first.
    for (let i = 0; i < periods.length; i++) {
      const periodId = periods[i]?.id;
      const ps = mergedShots[i];
      if (!periodId || !ps) continue;
      if (!(await updatePeriodShots(periodId, ps.home_shots, ps.away_shots))) return false;
    }

    // Recompute and upsert goalie shots-against based on the new shot totals.
    const allRosterGoalies = [...awayRoster, ...homeRoster].filter((e) => e.position === 'G');
    const lineupGoalieIds = new Set(
      lineup.filter((l) => l.position_slot === 'G').map((l) => l.player_id),
    );
    const goalieRosterList = allRosterGoalies.filter((g) => lineupGoalieIds.has(g.player_id));

    for (const goalie of goalieRosterList) {
      const sa = parseInt(computeAutoSA(goalie, goalieStats, game, mergedShots, goals), 10);
      if (!isNaN(sa)) {
        const saved = await upsertGoalieStat({
          goalie_id: goalie.player_id,
          team_id: goalie.team_id,
          shots_against: sa,
        });
        if (!saved) return false;
      }
    }

    return true;
  };

  const handleConfirm = () => {
    if (hidden) return;
    keepDraftRef.current = true;
    void runSettled(saveShots, { pending: 'Saving shots…' });
  };

  const teamRows = [
    {
      key: 'away' as const,
      logo: game.away_team.logo,
      logoDark: game.away_team.logo_dark,
      logoLight: game.away_team.logo_light,
      code: game.away_team.code,
      primary: game.away_team.primary_color,
      text: game.away_team.text_color,
      fieldKey: 'away_shots' as const,
    },
    {
      key: 'home' as const,
      logo: game.home_team.logo,
      logoDark: game.home_team.logo_dark,
      logoLight: game.home_team.logo_light,
      code: game.home_team.code,
      primary: game.home_team.primary_color,
      text: game.home_team.text_color,
      fieldKey: 'home_shots' as const,
    },
  ];

  return (
    <Modal
      open={open && !hidden}
      title="Edit Shots"
      onClose={handleClose}
      confirmLabel="Save"
      onConfirm={handleConfirm}
      confirmDisabled={!isDirty || !isValid}
    >
      <table className={`${styles.periodsTable} ${styles.shotsEditTable}`}>
        <thead>
          <tr>
            <th className={styles.thTeam} />
            {fields.map((field, i) => (
              <th
                key={field.id}
                className={styles.thPeriod}
              >
                {periods[i]?.label ?? ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teamRows.map((row) => (
            <tr key={row.key}>
              <td className={styles.tdTeam}>
                <span className={styles.linescoreTeam}>
                  <TeamLogo
                    logo={row.logo}
                    logoDark={row.logoDark}
                    logoLight={row.logoLight}
                    code={row.code}
                    primaryColor={row.primary}
                    textColor={row.text}
                    size={24}
                    shape="square"
                  />
                  <span className={styles.linescoreCode}>{row.code}</span>
                </span>
              </td>
              {fields.map((field, i) => (
                <td
                  key={field.id}
                  className={styles.tdShotsInput}
                >
                  <ControlledInputField
                    type="number"
                    control={control}
                    name={`periods.${i}.${row.fieldKey}`}
                    placeholder="0"
                    min={0}
                    transform={(v) => v.replace(/[^0-9]/g, '')}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
};

export default ShotsEditModal;
