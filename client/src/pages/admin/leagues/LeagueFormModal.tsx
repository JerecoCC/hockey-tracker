import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import Field from '../../../components/Field/Field';
import LogoUpload from '../../../components/LogoUpload/LogoUpload';
import Modal from '../../../components/Modal/Modal';
import { type CreateLeagueData, type LeagueRecord } from '../../../hooks/useLeagues';
import styles from './Leagues.module.scss';

const BEST_OF_OPTIONS = [
  { value: '3', label: 'Best of 3' },
  { value: '5', label: 'Best of 5' },
  { value: '7', label: 'Best of 7' },
];

const SHOOTOUT_OPTIONS = [
  { value: '3', label: '3 rounds' },
  { value: '5', label: '5 rounds' },
  { value: '7', label: '7 rounds' },
];

interface FormValues {
  name: string;
  code: string;
  logo: File | string | null;
  primary_color: string;
  text_color: string;
  best_of_playoff: string;
  best_of_shootout: string;
}

interface Props {
  open: boolean;
  editTarget: LeagueRecord | null;
  onClose: () => void;
  addLeague: (data: CreateLeagueData) => Promise<boolean>;
  updateLeague: (id: string, data: Partial<CreateLeagueData>) => Promise<boolean>;
  uploadLogo: (file: File) => Promise<string | null>;
}

const LeagueFormModal = (props: Props) => {
  const { open, editTarget, onClose, addLeague, updateLeague, uploadLogo } = props;
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
      best_of_playoff: '7',
      best_of_shootout: '3',
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
      best_of_playoff: String(editTarget?.best_of_playoff ?? 7),
      best_of_shootout: String(editTarget?.best_of_shootout ?? 3),
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
      best_of_playoff: parseInt(data.best_of_playoff, 10),
      best_of_shootout: parseInt(data.best_of_shootout, 10),
    };
    const ok = editTarget ? await updateLeague(editTarget.id, payload) : await addLeague(payload);
    if (ok) onClose();
  });

  return (
    <Modal
      open={open}
      title={editTarget ? 'Edit League' : 'Create League'}
      onClose={onClose}
      confirmLabel={isSubmitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Create League'}
      confirmForm="league-form"
      confirmDisabled={isSubmitting}
      busy={isSubmitting}
    >
      <form
        id="league-form"
        className={styles.form}
        onSubmit={onSubmit}
      >
        <LogoUpload
          control={control}
          name="logo"
          label="League Logo"
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
          <Field
            type="color"
            label="Primary Color"
            control={control}
            name="primary_color"
          />
          <Field
            type="color"
            label="Text Color"
            control={control}
            name="text_color"
          />
        </div>
        <Field
          label="Playoff Series Format"
          type="select"
          control={control}
          name="best_of_playoff"
          options={BEST_OF_OPTIONS}
        />
        <Field
          label="Shootout Rounds"
          type="select"
          control={control}
          name="best_of_shootout"
          options={SHOOTOUT_OPTIONS}
        />
      </form>
    </Modal>
  );
};

export default LeagueFormModal;
