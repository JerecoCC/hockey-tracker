import { useCallback, useLayoutEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import LogoUpload from '@/components/LogoUpload/LogoUpload';
import Modal from '@/components/Modal/Modal';
import { type LeagueFullRecord } from '@/hooks/useLeagueDetails';
import { type CreateLeagueData } from '@/hooks/useLeagues';
import { descriptionHtmlToTextarea, textareaToDescriptionHtml } from '@/lib/descriptionHtml';
import styles from './LeagueEditModal.module.scss';

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

const SCORING_SYSTEM_OPTIONS = [
  { value: '2-1-0', label: '2-1-0 (W / OT Loss / Loss)' },
  { value: '3-2-1-0', label: '3-2-1-0 (W / OT W / OT Loss / Loss)' },
];

interface FormValues {
  logo: File | string | null;
  icon: File | string | null;
  name: string;
  code: string;
  primary_color: string;
  text_color: string;
  best_of_playoff: string;
  best_of_shootout: string;
  scoring_system: '3-2-1-0' | '2-1-0';
  description: string | null;
}

interface Props {
  open: boolean;
  league: LeagueFullRecord;
  uploadLogo: (file: File) => Promise<string | null>;
  updateLeague: (id: string, data: Partial<CreateLeagueData>) => Promise<boolean>;
  onClose: () => void;
}

const LeagueEditModal = ({ open, league, uploadLogo, updateLeague, onClose }: Props) => {
  const formValues = useMemo<FormValues>(
    () => ({
      logo: league.logo ?? null,
      icon: league.icon ?? null,
      name: league.name,
      code: league.code,
      primary_color: league.primary_color,
      text_color: league.text_color,
      best_of_playoff: String(league.best_of_playoff),
      best_of_shootout: String(league.best_of_shootout),
      scoring_system: league.scoring_system,
      description: descriptionHtmlToTextarea(league.description),
    }),
    [league],
  );
  const {
    control,
    handleSubmit,
    reset,
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
    let logoUrl: string | null = typeof data.logo === 'string' ? data.logo : null;
    if (data.logo instanceof File) {
      const url = await uploadLogo(data.logo);
      if (!url) return;
      logoUrl = url;
    }
    let iconUrl: string | null = typeof data.icon === 'string' ? data.icon : null;
    if (data.icon instanceof File) {
      const url = await uploadLogo(data.icon);
      if (!url) return;
      iconUrl = url;
    }
    const payload: Partial<CreateLeagueData> = {
      logo: logoUrl,
      icon: iconUrl,
      name: data.name,
      code: data.code,
      primary_color: data.primary_color,
      text_color: data.text_color,
      best_of_playoff: parseInt(data.best_of_playoff, 10),
      best_of_shootout: parseInt(data.best_of_shootout, 10),
      scoring_system: data.scoring_system,
      description: textareaToDescriptionHtml(data.description) ?? undefined,
    };
    const ok = await updateLeague(league.id, payload);
    if (ok) handleClose();
  });

  return (
    <Modal
      open={open}
      title="Edit League"
      onClose={handleClose}
      confirmLabel={isSubmitting ? 'Saving…' : 'Save Changes'}
      confirmForm="league-edit-form"
      confirmDisabled={isSubmitting || !isDirty || !isValid}
      busy={isSubmitting}
    >
      <form
        id="league-edit-form"
        className={styles.form}
        onSubmit={onSubmit}
      >
        <div className={styles.assetRow}>
          <LogoUpload
            control={control}
            name="logo"
            label="Logo"
            disabled={isSubmitting}
          />
          <LogoUpload
            control={control}
            name="icon"
            label="Header Icon"
            accept="image/x-icon,image/vnd.microsoft.icon,.ico"
            hint="Upload .ico"
            disabled={isSubmitting}
          />
        </div>
        <Field
          label="Name"
          required
          control={control}
          name="name"
          rules={{ required: true }}
          placeholder="e.g. National Hockey League"
          autoFocus
          disabled={isSubmitting}
        />
        <Field
          label="Code"
          required
          control={control}
          name="code"
          rules={{ required: true }}
          transform={(v) => v.toUpperCase()}
          placeholder="e.g. NHL"
          disabled={isSubmitting}
        />
        <div className={styles.colorRow}>
          <Field
            label="Primary Color"
            type="color"
            control={control}
            name="primary_color"
            disabled={isSubmitting}
          />
          <Field
            label="Text Color"
            type="color"
            control={control}
            name="text_color"
            disabled={isSubmitting}
          />
        </div>
        <div className={styles.settingsGrid}>
          <Field
            label="Playoff Series Format"
            type="select"
            control={control}
            name="best_of_playoff"
            options={BEST_OF_OPTIONS}
            disabled={isSubmitting}
          />
          <Field
            label="Shootout Rounds"
            type="select"
            control={control}
            name="best_of_shootout"
            options={SHOOTOUT_OPTIONS}
            disabled={isSubmitting}
          />
          <div className={styles.settingsGridFull}>
            <Field
              label="Scoring System"
              type="select"
              control={control}
              name="scoring_system"
              options={SCORING_SYSTEM_OPTIONS}
              disabled={isSubmitting}
            />
          </div>
        </div>
        <Field
          label="Description"
          type="textarea"
          control={control}
          name="description"
          rows={6}
          placeholder="Add a description..."
          disabled={isSubmitting}
        />
      </form>
    </Modal>
  );
};

export default LeagueEditModal;
