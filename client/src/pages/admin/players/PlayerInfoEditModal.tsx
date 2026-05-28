import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
import {
  type CreatePlayerData,
  type PlayerRecord,
  type PlayerShoots,
} from '@/hooks/useLeaguePlayers';
import styles from '../leagues/PlayerFormModal.module.scss';

const SHOOTS_OPTIONS = [
  { value: 'L', label: 'Left' },
  { value: 'R', label: 'Right' },
];

const cmToFtIn = (cm: number) => {
  const totalInches = cm / 2.54;
  let ft = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches % 12);
  if (inches === 12) {
    ft += 1;
    inches = 0;
  }
  return { ft, inches };
};

const ftInToCm = (ft: number, inches: number) => Math.round((ft * 12 + inches) * 2.54);

interface FormValues {
  shoots: PlayerShoots | null;
  date_of_birth: string;
  birth_city: string;
  birth_country: string;
  nationality: string;
  height_ft: string;
  height_in: string;
  weight_lbs: string;
}

interface Props {
  open: boolean;
  player: PlayerRecord | null;
  onClose: () => void;
  updatePlayer: (id: string, data: Partial<CreatePlayerData>) => Promise<boolean>;
}

const PlayerInfoEditModal = ({ open, player, onClose, updatePlayer }: Props) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      shoots: null,
      date_of_birth: '',
      birth_city: '',
      birth_country: '',
      nationality: '',
      height_ft: '',
      height_in: '',
      weight_lbs: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    const { ft, inches } =
      player?.height_cm != null
        ? cmToFtIn(player.height_cm)
        : { ft: null as null, inches: null as null };
    reset({
      shoots: player?.shoots ?? null,
      date_of_birth: player?.date_of_birth ?? '',
      birth_city: player?.birth_city ?? '',
      birth_country: player?.birth_country ?? '',
      nationality: player?.nationality ?? '',
      height_ft: ft != null ? String(ft) : '',
      height_in: inches != null ? String(inches) : '',
      weight_lbs: player?.weight_lbs != null ? String(player.weight_lbs) : '',
    });
  }, [open, player, reset]);

  const onSubmit = handleSubmit(async (data) => {
    if (!player) return;
    const hasFt = data.height_ft !== '';
    const hasIn = data.height_in !== '';
    const ok = await updatePlayer(player.id, {
      shoots: data.shoots || null,
      date_of_birth: data.date_of_birth || null,
      birth_city: data.birth_city || null,
      birth_country: data.birth_country || null,
      nationality: data.nationality || null,
      height_cm:
        hasFt || hasIn
          ? ftInToCm(hasFt ? Number(data.height_ft) : 0, hasIn ? Number(data.height_in) : 0)
          : null,
      weight_lbs: data.weight_lbs ? Number(data.weight_lbs) : null,
    });
    if (ok) onClose();
  });

  return (
    <Modal
      open={open}
      title="Edit Player Info"
      onClose={onClose}
      confirmLabel={isSubmitting ? 'Saving…' : 'Save Changes'}
      confirmForm="player-info-form"
      confirmDisabled={isSubmitting}
      busy={isSubmitting}
    >
      <form
        id="player-info-form"
        className={styles.form}
        onSubmit={onSubmit}
      >
        <div className={styles.row}>
          <Field
            type="datepicker"
            label="Date of Birth"
            control={control}
            name="date_of_birth"
            placeholder="YYYY-MM-DD"
            disabled={isSubmitting}
          />
          <Field
            label="Birth City"
            control={control}
            name="birth_city"
            placeholder="e.g. Edmonton"
            autoFocus
            disabled={isSubmitting}
          />
        </div>
        <div className={styles.row}>
          <Field
            label="Birth Country"
            control={control}
            name="birth_country"
            placeholder="e.g. CAN"
            disabled={isSubmitting}
          />
          <Field
            label="Nationality"
            control={control}
            name="nationality"
            placeholder="e.g. CAN"
            disabled={isSubmitting}
          />
        </div>
        <div className={styles.row}>
          <Field
            type="select"
            label={player?.position === 'G' ? 'Catches' : 'Shoots'}
            control={control}
            name="shoots"
            options={SHOOTS_OPTIONS}
            placeholder="Select side"
            disabled={isSubmitting}
          />
          <Field
            type="number"
            label="Weight"
            suffix="lbs"
            control={control}
            name="weight_lbs"
            placeholder="e.g. 193"
            min={0}
            disabled={isSubmitting}
            rules={{ validate: (v) => !v || Number(v) >= 0 }}
          />
        </div>
        <div className={styles.heightGroup}>
          <span className={styles.heightGroupLabel}>Height</span>
          <div className={styles.heightInputs}>
            <Field
              type="number"
              suffix="ft"
              control={control}
              name="height_ft"
              placeholder="6"
              min={0}
              disabled={isSubmitting}
              rules={{ validate: (v) => !v || (Number(v) >= 0 && Number.isInteger(Number(v))) }}
            />
            <Field
              type="number"
              suffix="in"
              control={control}
              name="height_in"
              placeholder="0"
              min={0}
              max={11}
              disabled={isSubmitting}
              rules={{
                validate: (v) =>
                  !v || (Number(v) >= 0 && Number(v) <= 11 && Number.isInteger(Number(v))),
              }}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default PlayerInfoEditModal;
