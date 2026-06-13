import { useCallback, useLayoutEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import LogoUpload from '@/components/LogoUpload/LogoUpload';
import Modal from '@/components/Modal/Modal';
import { type LeagueFullRecord } from '@/hooks/useLeagueDetails';
import { type CreateLeagueData } from '@/hooks/useLeagues';
import { descriptionHtmlToTextarea, textareaToDescriptionHtml } from '@/lib/descriptionHtml';
import styles from './LeagueEditModal.module.scss';

interface FormValues {
  logo: File | string | null;
  icon: File | string | null;
  name: string;
  code: string;
  primary_color: string;
  text_color: string;
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
