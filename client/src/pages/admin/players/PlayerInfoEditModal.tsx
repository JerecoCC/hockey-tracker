import { useCallback, useLayoutEffect, useMemo, type FocusEvent } from 'react';
import { Controller, useForm } from 'react-hook-form';
import Divider from '@jerecocc/tracker-ui/components/Divider/Divider';
import {
  ControlledDatePickerField,
  ControlledInputField,
  ControlledSelectField,
} from '@/components/form/ControlledFields';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import SegmentedControl from '@jerecocc/tracker-ui/components/SegmentedControl/SegmentedControl';
import {
  type CreatePlayerData,
  type PlayerRecord,
  type PlayerShoots,
} from '@/hooks/useLeaguePlayers';
import { getPlayerStatus, type PlayerStatus } from '@/lib/playerStatus';
import styles from '../leagues/PlayerFormModal.module.scss';

const SHOOTS_OPTIONS = [
  { value: 'L', label: 'Left' },
  { value: 'R', label: 'Right' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const NO_ROOKIE_SEASON = 'none';

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

const validateFeet = (value: string) => {
  if (!value) return true;
  const feet = Number(value);
  return (Number.isInteger(feet) && feet >= 0) || 'Feet must be a whole number';
};

const validateInches = (value: string) => {
  if (!value) return true;
  const inches = Number(value);
  return (Number.isInteger(inches) && inches >= 0 && inches <= 11) || 'Inches must be 0-11';
};

const isWholeNumberInput = (value: string) => value === '' || /^\d+$/.test(value);

interface FormValues {
  league_player_number: string;
  status: PlayerStatus;
  shoots: PlayerShoots | null;
  date_of_birth: string;
  birth_city: string;
  birth_country: string;
  height_ft: string;
  height_in: string;
  weight_lbs: string;
  rookie_season_id: string;
}

interface RookieSeasonOption {
  id: string;
  name: string;
  is_current?: boolean;
}

interface Props {
  open: boolean;
  player: PlayerRecord | null;
  seasons: RookieSeasonOption[];
  onClose: () => void;
  updatePlayer: (id: string, data: Partial<CreatePlayerData>) => Promise<boolean>;
}

const PlayerInfoEditModal = ({ open, player, seasons, onClose, updatePlayer }: Props) => {
  const playerStatus = player ? getPlayerStatus(player) : 'active';
  const isRetired = playerStatus === 'retired';
  const formValues = useMemo<FormValues>(() => {
    const { ft, inches } =
      player?.height_cm != null
        ? cmToFtIn(player.height_cm)
        : { ft: null as null, inches: null as null };
    return {
      league_player_number: player?.league_player_number ?? '',
      status: playerStatus,
      shoots: player?.shoots ?? null,
      date_of_birth: player?.date_of_birth ?? '',
      birth_city: player?.birth_city ?? '',
      birth_country: player?.birth_country ?? '',
      height_ft: ft != null ? String(ft) : '',
      height_in: inches != null ? String(inches) : '',
      weight_lbs: player?.weight_lbs != null ? String(player.weight_lbs) : '',
      rookie_season_id: player?.rookie_season_id ?? NO_ROOKIE_SEASON,
    };
  }, [player, playerStatus]);
  const rookieSeasonOptions = useMemo(
    () => [
      { value: NO_ROOKIE_SEASON, label: 'No rookie season' },
      ...seasons.map((season) => ({
        value: season.id,
        label: season.is_current ? `${season.name} (Current)` : season.name,
      })),
    ],
    [seasons],
  );
  const {
    control,
    handleSubmit,
    reset,
    getValues,
    setError,
    setValue,
    formState: { isSubmitting, isDirty, isValid },
  } = useForm<FormValues>({
    defaultValues: formValues,
    mode: 'onChange',
  });

  useLayoutEffect(() => {
    reset(formValues);
  }, [formValues, reset]);

  const handleClose = useCallback(() => {
    reset(formValues);
    onClose();
  }, [formValues, onClose, reset]);

  const onSubmit = handleSubmit(async (data) => {
    if (!player) return;
    const feetError = validateFeet(data.height_ft);
    const inchesError = validateInches(data.height_in);
    if (feetError !== true) {
      setError('height_ft', { type: 'validate', message: feetError });
      return;
    }
    if (inchesError !== true) {
      setError('height_in', { type: 'validate', message: inchesError });
      return;
    }

    const hasFt = data.height_ft !== '';
    const hasIn = data.height_in !== '';
    const ok = await updatePlayer(player.id, {
      league_player_number: data.league_player_number.trim() || null,
      ...(!isRetired ? { status: data.status } : {}),
      shoots: data.shoots || null,
      date_of_birth: data.date_of_birth || null,
      birth_city: data.birth_city || null,
      birth_country: data.birth_country || null,
      height_cm:
        hasFt || hasIn
          ? ftInToCm(hasFt ? Number(data.height_ft) : 0, hasIn ? Number(data.height_in) : 0)
          : null,
      weight_lbs: data.weight_lbs ? Number(data.weight_lbs) : null,
      ...(seasons.length > 0
        ? {
            rookie_season_id:
              data.rookie_season_id === NO_ROOKIE_SEASON ? null : data.rookie_season_id,
          }
        : {}),
    });
    if (ok) handleClose();
  });

  const normalizeBirthCity = (value: string) => {
    const locationParts = value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (locationParts.length < 2) return;

    const country = locationParts[locationParts.length - 1];
    const city = locationParts.slice(0, -1).join(', ');
    setValue('birth_city', city, { shouldDirty: true, shouldTouch: true });
    setValue('birth_country', country, { shouldDirty: true, shouldTouch: true });
  };

  const handleBirthCityBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (getValues('birth_country')) return;
    normalizeBirthCity(event.target.value);
  };

  return (
    <Modal
      open={open}
      title="Edit Player Info"
      onClose={handleClose}
      confirmLabel={isSubmitting ? 'Saving…' : 'Save Changes'}
      confirmForm="player-info-form"
      confirmDisabled={isSubmitting || !isDirty || !isValid}
      busy={isSubmitting}
    >
      <form
        id="player-info-form"
        className={styles.form}
        onSubmit={onSubmit}
      >
        <div className={seasons.length > 0 ? styles.playerInfoIdentityRow : styles.fullRow}>
          <ControlledInputField
            label="League Player Number"
            control={control}
            name="league_player_number"
            placeholder="e.g. 8478402"
            inputMode="numeric"
            transform={(value) => value.trim()}
            disabled={isSubmitting}
          />
          {seasons.length > 0 && (
            <ControlledSelectField
              label="Rookie Season"
              control={control}
              name="rookie_season_id"
              options={rookieSeasonOptions}
              placeholder="Select rookie season"
              disabled={isSubmitting}
            />
          )}
        </div>
        {!isRetired && (
          <div className={styles.fullRow}>
            <div className={styles.segmentedField}>
              <span className={styles.heightGroupLabel}>Status</span>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <SegmentedControl
                    value={field.value}
                    onChange={(value) => field.onChange(value as PlayerStatus)}
                    variant="field"
                    options={STATUS_OPTIONS}
                    disabled={isSubmitting}
                  />
                )}
              />
            </div>
          </div>
        )}
        <Divider className={styles.divider} />
        <div className={styles.playerInfoBirthRow}>
          <ControlledInputField
            label="Birth City"
            control={control}
            name="birth_city"
            placeholder="e.g. Edmonton"
            autoFocus
            disabled={isSubmitting}
            onBlur={handleBirthCityBlur}
          />
          <ControlledInputField
            label="Birth Country"
            control={control}
            name="birth_country"
            placeholder="CAN"
            disabled={isSubmitting}
          />
        </div>
        <div className={styles.fullRow}>
          <ControlledDatePickerField
            label="Date of Birth"
            control={control}
            name="date_of_birth"
            placeholder="YYYY-MM-DD"
            disabled={isSubmitting}
          />
        </div>
        <div className={styles.playerInfoVitalsRow}>
          <div className={styles.heightGroup}>
            <span className={styles.heightGroupLabel}>Height</span>
            <div className={styles.heightUnitFields}>
              <Controller
                control={control}
                name="height_ft"
                rules={{ validate: validateFeet }}
                render={({ field, fieldState }) => (
                  <label
                    className={[
                      styles.unitField,
                      fieldState.error ? styles.unitFieldError : '',
                      isSubmitting ? styles.unitFieldDisabled : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <input
                      {...field}
                      type="number"
                      min={0}
                      placeholder="6"
                      disabled={isSubmitting}
                      aria-label="Height feet"
                      aria-invalid={fieldState.invalid}
                      onChange={(event) => {
                        if (isWholeNumberInput(event.target.value)) {
                          field.onChange(event.target.value);
                        }
                      }}
                    />
                    <Divider
                      orientation="vertical"
                      className={styles.unitDivider}
                    />
                    <span className={styles.unitSuffix}>ft</span>
                  </label>
                )}
              />
              <Controller
                control={control}
                name="height_in"
                rules={{ validate: validateInches }}
                render={({ field, fieldState }) => (
                  <label
                    className={[
                      styles.unitField,
                      fieldState.error ? styles.unitFieldError : '',
                      isSubmitting ? styles.unitFieldDisabled : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <input
                      {...field}
                      type="number"
                      min={0}
                      max={11}
                      placeholder="0"
                      disabled={isSubmitting}
                      aria-label="Height inches"
                      aria-invalid={fieldState.invalid}
                      onChange={(event) => {
                        const { value } = event.target;
                        if (isWholeNumberInput(value) && (!value || Number(value) <= 11)) {
                          field.onChange(value);
                        }
                      }}
                    />
                    <Divider
                      orientation="vertical"
                      className={styles.unitDivider}
                    />
                    <span className={styles.unitSuffix}>in</span>
                  </label>
                )}
              />
            </div>
          </div>
          <div className={styles.heightGroup}>
            <span className={styles.heightGroupLabel}>Weight</span>
            <Controller
              control={control}
              name="weight_lbs"
              rules={{ validate: (v) => !v || Number(v) >= 0 || 'Weight must be 0 or greater' }}
              render={({ field, fieldState }) => (
                <label
                  className={[
                    styles.unitField,
                    fieldState.error ? styles.unitFieldError : '',
                    isSubmitting ? styles.unitFieldDisabled : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <input
                    {...field}
                    type="number"
                    min={0}
                    placeholder="e.g. 193"
                    disabled={isSubmitting}
                    aria-label="Weight"
                    aria-invalid={fieldState.invalid}
                  />
                  <Divider
                    orientation="vertical"
                    className={styles.unitDivider}
                  />
                  <span className={styles.unitSuffix}>lbs</span>
                </label>
              )}
            />
          </div>
        </div>
        <div className={styles.fullRow}>
          <div className={styles.segmentedField}>
            <span className={styles.heightGroupLabel}>
              {player?.position === 'G' ? 'Catches' : 'Shoots'}
            </span>
            <Controller
              control={control}
              name="shoots"
              render={({ field }) => (
                <SegmentedControl
                  value={field.value}
                  onChange={(value) => field.onChange(value as PlayerShoots)}
                  variant="field"
                  options={SHOOTS_OPTIONS}
                  disabled={isSubmitting}
                />
              )}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default PlayerInfoEditModal;
