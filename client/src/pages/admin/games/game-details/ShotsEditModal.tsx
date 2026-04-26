import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import Field from '../../../../components/Field/Field';
import Modal from '../../../../components/Modal/Modal';
import { type GameRecord } from '../../../../hooks/useGames';
import styles from '../GameDetailsPage.module.scss';

type ShotsEditFormValues = { periods: Array<{ away_shots: string; home_shots: string }> };

interface LinescorePeriod { id: string; label: string }

interface Props {
  open: boolean;
  game: GameRecord;
  periods: LinescorePeriod[];
  onClose: () => void;
  updatePeriodShots: (period: string, home: number, away: number) => Promise<boolean | undefined>;
}

const ShotsEditModal = ({ open, game, periods, onClose, updatePeriodShots }: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const { control, reset, getValues } = useForm<ShotsEditFormValues>({ defaultValues: { periods: [] } });
  const { fields } = useFieldArray({ control, name: 'periods' });

  useEffect(() => {
    if (open) {
      reset({
        periods: periods.map((p) => {
          const ps = game.period_shots.find((s) => s.period === p.id);
          return { away_shots: ps ? String(ps.away_shots) : '', home_shots: ps ? String(ps.home_shots) : '' };
        }),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleConfirm = async () => {
    const { periods: rows } = getValues();
    setSubmitting(true);
    for (let i = 0; i < periods.length; i++) {
      const row = rows[i];
      const periodId = periods[i]?.id;
      if (!row || !periodId) continue;
      const away = parseInt(row.away_shots, 10);
      const home = parseInt(row.home_shots, 10);
      if (!isNaN(away) && !isNaN(home)) {
        await updatePeriodShots(periodId, home, away);
      }
    }
    setSubmitting(false);
    onClose();
  };

  const teamRows = [
    { key: 'away' as const, logo: game.away_team_logo, code: game.away_team_code, primary: game.away_team_primary_color, text: game.away_team_text_color, fieldKey: 'away_shots' as const },
    { key: 'home' as const, logo: game.home_team_logo, code: game.home_team_code, primary: game.home_team_primary_color, text: game.home_team_text_color, fieldKey: 'home_shots' as const },
  ];

  return (
    <Modal open={open} title="Edit Shots" onClose={onClose}
      confirmLabel={submitting ? 'Saving…' : 'Save'}
      onConfirm={handleConfirm} confirmDisabled={submitting} busy={submitting}>
      <table className={`${styles.periodsTable} ${styles.shotsEditTable}`}>
        <thead>
          <tr>
            <th className={styles.thTeam} />
            {fields.map((field, i) => (
              <th key={field.id} className={styles.thPeriod}>{periods[i]?.label ?? ''}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teamRows.map((row) => (
            <tr key={row.key}>
              <td className={styles.tdTeam}>
                <span className={styles.linescoreTeam}>
                  {row.logo ? <img src={row.logo} alt={row.code} className={styles.linescoreLogo} /> : <span className={styles.linescoreLogoPlaceholder} style={{ background: row.primary, color: row.text }}>{row.code?.slice(0, 1)}</span>}
                  <span className={styles.linescoreCode}>{row.code}</span>
                </span>
              </td>
              {fields.map((field, i) => (
                <td key={field.id} className={styles.tdShotsInput}>
                  <Field type="number" control={control} name={`periods.${i}.${row.fieldKey}`} placeholder="0" min={0} disabled={submitting} transform={(v) => v.replace(/[^0-9]/g, '')} />
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
