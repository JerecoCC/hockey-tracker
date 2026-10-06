import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import { ControlledInputField, ControlledSelectField } from '@/components/form/ControlledFields';
import type { GameRecord } from '@/hooks/useGames';
import usePersonalGames, { type PersonalGameResultType } from '@/hooks/usePersonalGames';
import styles from './PersonalGameModal.module.scss';

const RESULT_OPTIONS: { value: PersonalGameResultType; label: string }[] = [
  { value: 'regulation', label: 'Regulation' },
  { value: 'overtime', label: 'Overtime' },
  { value: 'shootout', label: 'Shootout' },
];

const SCORE_RE = /^\d{1,2}$/;

interface FormValues {
  away_score: string;
  home_score: string;
  result_type: PersonalGameResultType;
}

const scoreRules = {
  required: 'Score is required',
  validate: (value: string) => SCORE_RE.test(value) || 'Enter a whole number',
};

interface Props {
  /** The personal game being marked watched, or null when closed. */
  game: GameRecord | null;
  onClose: () => void;
}

/**
 * Marks a personal game watched by recording its final score: the score is only known once
 * the user has watched the game.
 */
const PersonalGameScoreModal = ({ game, onClose }: Props) => {
  const { recordPersonalGameScore } = usePersonalGames();
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, isValid },
  } = useForm<FormValues>({
    defaultValues: { away_score: '', home_score: '', result_type: 'regulation' },
    mode: 'onChange',
  });

  useEffect(() => {
    if (game) reset({ away_score: '', home_score: '', result_type: 'regulation' });
  }, [game, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!game) return;
    const saved = await recordPersonalGameScore(game.id, {
      away_score: Number(values.away_score),
      home_score: Number(values.home_score),
      result_type: values.result_type,
    });
    if (saved) onClose();
  });

  if (!game) return null;
  const awayLabel = game.away_team.code ?? game.away_team.name ?? 'Away';
  const homeLabel = game.home_team.code ?? game.home_team.name ?? 'Home';

  return (
    <Modal
      open
      title="Mark as Watched"
      onClose={onClose}
      confirmLabel={isSubmitting ? 'Saving…' : 'Mark Watched'}
      confirmIcon="visibility"
      confirmForm="personal-game-score-form"
      confirmDisabled={isSubmitting || !isValid}
      busy={isSubmitting}
    >
      <form
        id="personal-game-score-form"
        className={styles.form}
        onSubmit={onSubmit}
      >
        <p className={styles.copy}>
          Enter the final score of {awayLabel} @ {homeLabel} to mark it as watched.
        </p>
        <div className={styles.full}>
          <ControlledInputField
            label={`${awayLabel} Score`}
            control={control}
            name="away_score"
            type="number"
            min={0}
            max={99}
            disabled={isSubmitting}
            autoFocus
            required
            rules={scoreRules}
          />
        </div>
        <div className={styles.full}>
          <ControlledInputField
            label={`${homeLabel} Score`}
            control={control}
            name="home_score"
            type="number"
            min={0}
            max={99}
            disabled={isSubmitting}
            required
            rules={scoreRules}
          />
        </div>
        <div className={styles.full}>
          <ControlledSelectField
            label="Result"
            control={control}
            name="result_type"
            options={RESULT_OPTIONS}
            disabled={isSubmitting}
            rules={{
              validate: (value, values) =>
                value === 'regulation' ||
                values.away_score !== values.home_score ||
                'Overtime and shootouts need a winner',
            }}
          />
        </div>
      </form>
    </Modal>
  );
};

export default PersonalGameScoreModal;
