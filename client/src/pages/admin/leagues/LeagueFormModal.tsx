import { useEffect, useRef } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import Button from '../../../components/Button/Button';
import Field from '../../../components/Field/Field';
import LogoUpload from '../../../components/LogoUpload/LogoUpload';
import Modal from '../../../components/Modal/Modal';
import { type CreateLeagueData, type LeagueRecord } from '../../../hooks/useLeagues';
import styles from './Leagues.module.scss';

// ── Inline color picker ────────────────────────────────────────────────
interface ColorPickerInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

const ColorPickerInput = ({ value, onChange, onBlur }: ColorPickerInputProps) => {
  const pickerRef = useRef<HTMLInputElement>(null);
  return (
    <div className={styles.colorInputWrapper}>
      <button
        type="button"
        className={styles.colorSwatch}
        style={{ background: value }}
        onClick={() => pickerRef.current?.click()}
      />
      <input
        ref={pickerRef}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={styles.colorHiddenInput}
        tabIndex={-1}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={styles.colorHexInput}
        spellCheck={false}
        maxLength={7}
      />
    </div>
  );
};

interface FormValues {
  name: string;
  code: string;
  logo: File | string | null;
  primary_color: string;
  text_color: string;
}

interface Props {
  open: boolean;
  editTarget: LeagueRecord | null;
  onClose: () => void;
  addLeague: (data: CreateLeagueData) => Promise<boolean>;
  updateLeague: (id: string, data: Partial<CreateLeagueData>) => Promise<boolean>;
  uploadLogo: (file: File) => Promise<string | null>;
}

const LeagueFormModal = ({
  open,
  editTarget,
  onClose,
  addLeague,
  updateLeague,
  uploadLogo,
}: Props) => {
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      name: '',
      code: '',
      logo: null,
      primary_color: '#334155',
      text_color: '#ffffff',
    },
  });

  const nameValue = useWatch({ control, name: 'name' });

  // Always auto-derive code from name initials whenever name changes
  useEffect(() => {
    const auto = nameValue
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
    setValue('code', auto);
  }, [nameValue, setValue]);

  useEffect(() => {
    if (!open) return;
    reset({
      name: editTarget?.name ?? '',
      code: editTarget?.code ?? '',
      logo: editTarget?.logo ?? null,
      primary_color: editTarget?.primary_color ?? '#334155',
      text_color: editTarget?.text_color ?? '#ffffff',
    });
  }, [open, editTarget, reset]);

  const onSubmit = handleSubmit(async (data) => {
    let logoUrl: string | null = typeof data.logo === 'string' ? data.logo : null;
    if (data.logo instanceof File) {
      const url = await uploadLogo(data.logo);
      if (!url) return;
      logoUrl = url;
    }
    const payload: CreateLeagueData = {
      name: data.name,
      code: data.code,
      logo: logoUrl,
      primary_color: data.primary_color,
      text_color: data.text_color,
    };
    const ok = editTarget ? await updateLeague(editTarget.id, payload) : await addLeague(payload);
    if (ok) onClose();
  });

  return (
    <Modal
      open={open}
      title={editTarget ? 'Edit League' : 'Add League'}
      onClose={onClose}
    >
      <form
        className={styles.form}
        onSubmit={onSubmit}
      >
        <LogoUpload
          control={control}
          name="logo"
          label="Add League Logo"
        />
        <Field
          label="Name"
          required
          control={control}
          name="name"
          rules={{ required: true }}
          placeholder="e.g. National Hockey League"
          autoFocus
        />
        <Field
          label="Code"
          required
          control={control}
          name="code"
          rules={{ required: true }}
          transform={(v) => v.toUpperCase()}
          placeholder="e.g. NHL"
        />
        <div className={styles.colorRow}>
          <Controller
            control={control}
            name="primary_color"
            render={({ field }) => (
              <div className={styles.colorLabel}>
                <span className={styles.colorLabelText}>Primary Color</span>
                <ColorPickerInput
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              </div>
            )}
          />
          <Controller
            control={control}
            name="text_color"
            render={({ field }) => (
              <div className={styles.colorLabel}>
                <span className={styles.colorLabelText}>Text Color</span>
                <ColorPickerInput
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              </div>
            )}
          />
        </div>
        <div className={styles.formActions}>
          <Button
            type="button"
            variant="outlined"
            intent="neutral"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Add League'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default LeagueFormModal;
