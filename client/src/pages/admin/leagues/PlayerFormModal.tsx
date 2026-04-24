import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Field from '../../../components/Field/Field';
import Modal from '../../../components/Modal/Modal';
import {
  type CreatePlayerData,
  type PlayerRecord,
  type PlayerPosition,
  type PlayerShoots,
} from '../../../hooks/useLeaguePlayers';
import styles from './PlayerFormModal.module.scss';

const POSITION_OPTIONS = [
  { value: 'C', label: 'Center' },
  { value: 'LW', label: 'Left Wing' },
  { value: 'RW', label: 'Right Wing' },
  { value: 'D', label: 'Defense' },
  { value: 'G', label: 'Goalie' },
];

const SHOOTS_OPTIONS = [
  { value: 'L', label: 'Left' },
  { value: 'R', label: 'Right' },
];

// ── Height conversion helpers ────────────────────────────────────────────
const cmToFtIn = (cm: number) => {
  const totalInches = cm / 2.54;
  let ft = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches % 12);
  if (inches === 12) {
    ft++;
    inches = 0;
  }
  return { ft, inches };
};

const ftInToCm = (ft: number, inches: number) => Math.round((ft * 12 + inches) * 2.54);

interface FormValues {
  first_name: string;
  last_name: string;
  position: PlayerPosition | null;
  shoots: PlayerShoots | null;
  date_of_birth: string;
  birth_city: string;
  birth_country: string;
  nationality: string;
  height_ft: string;
  height_in: string;
  weight_lbs: string;
  jersey_number: string;
}

interface Props {
  open: boolean;
  editTarget: PlayerRecord | null;
  onClose: () => void;
  addPlayer?: (data: CreatePlayerData) => Promise<boolean>;
  updatePlayer: (id: string, data: Partial<CreatePlayerData>) => Promise<boolean>;
  /** When provided, the Jersey Number field is shown and saved via this callback on edit. */
  updateJerseyNumber?: (jerseyNumber: number | null) => Promise<boolean>;
}

const PlayerFormModal = ({
  open,
  editTarget,
  onClose,
  addPlayer,
  updatePlayer,
  updateJerseyNumber,
}: Props) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      first_name: '',
      last_name: '',
      position: null,
      shoots: null,
      date_of_birth: '',
      birth_city: '',
      birth_country: '',
      nationality: '',
      height_ft: '',
      height_in: '',
      weight_lbs: '',
      jersey_number: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    const { ft, inches } =
      editTarget?.height_cm != null
        ? cmToFtIn(editTarget.height_cm)
        : { ft: null as null, inches: null as null };
    reset({
      first_name: editTarget?.first_name ?? '',
      last_name: editTarget?.last_name ?? '',
      position: editTarget?.position ?? null,
      shoots: editTarget?.shoots ?? null,
      date_of_birth: editTarget?.date_of_birth ?? '',
      birth_city: editTarget?.birth_city ?? '',
      birth_country: editTarget?.birth_country ?? '',
      nationality: editTarget?.nationality ?? '',
      height_ft: ft != null ? String(ft) : '',
      height_in: inches != null ? String(inches) : '',
      weight_lbs: editTarget?.weight_lbs != null ? String(editTarget.weight_lbs) : '',
      jersey_number: editTarget?.jersey_number != null ? String(editTarget.jersey_number) : '',
    });
  }, [open, editTarget, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const hasFt = data.height_ft !== '';
    const hasIn = data.height_in !== '';
    const height_cm =
      hasFt || hasIn
        ? ftInToCm(hasFt ? Number(data.height_ft) : 0, hasIn ? Number(data.height_in) : 0)
        : null;
    const payload: CreatePlayerData = {
      first_name: data.first_name,
      last_name: data.last_name,
      position: data.position || null,
      shoots: data.shoots || null,
      date_of_birth: data.date_of_birth || null,
      birth_city: data.birth_city || null,
      birth_country: data.birth_country || null,
      nationality: data.nationality || null,
      height_cm,
      weight_lbs: data.weight_lbs ? Number(data.weight_lbs) : null,
    };
    const ok = editTarget
      ? await updatePlayer(editTarget.id, payload)
      : addPlayer
        ? await addPlayer(payload)
        : false;
    if (!ok) return;

    if (editTarget && updateJerseyNumber) {
      const newJersey = data.jersey_number ? Number(data.jersey_number) : null;
      await updateJerseyNumber(newJersey);
    }

    onClose();
  });

  return (
    <Modal
      open={open}
      title={editTarget ? 'Edit Player' : 'Create Player'}
      onClose={onClose}
      confirmLabel={isSubmitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Player'}
      confirmForm="player-form"
      confirmDisabled={isSubmitting}
      busy={isSubmitting}
    >
      <form
        id="player-form"
        className={styles.form}
        onSubmit={onSubmit}
      >
        <div className={updateJerseyNumber ? styles.nameRowWithJersey : styles.row}>
          {updateJerseyNumber && (
            <Field
              type="number"
              label="Jersey #"
              control={control}
              name="jersey_number"
              placeholder="e.g. 97"
              min={0}
              max={99}
              disabled={isSubmitting}
              rules={{
                validate: (v) =>
                  !v || (Number(v) >= 0 && Number(v) <= 99 && Number.isInteger(Number(v))),
              }}
            />
          )}
          <Field
            label="First Name"
            required
            control={control}
            name="first_name"
            rules={{ required: true }}
            placeholder="e.g. Connor"
            autoFocus
            disabled={isSubmitting}
          />
          <Field
            label="Last Name"
            required
            control={control}
            name="last_name"
            rules={{ required: true }}
            placeholder="e.g. McDavid"
            disabled={isSubmitting}
          />
        </div>
        <div className={styles.row}>
          <Field
            type="select"
            label="Position"
            required
            control={control}
            name="position"
            options={POSITION_OPTIONS}
            placeholder="Select position"
            rules={{ required: true }}
            disabled={isSubmitting}
          />
          <Field
            type="select"
            label="Shoots"
            control={control}
            name="shoots"
            options={SHOOTS_OPTIONS}
            placeholder="Select side"
            disabled={isSubmitting}
          />
        </div>
        <div className={styles.row}>
          <Field
            type="datepicker"
            label="Date of Birth"
            control={control}
            name="date_of_birth"
            placeholder="YYYY-MM-DD"
          />
          <Field
            label="Birth City"
            control={control}
            name="birth_city"
            placeholder="e.g. Edmonton"
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
      </form>
    </Modal>
  );
};

export default PlayerFormModal;
