import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../../../components/Button/Button';
import Field from '../../../components/Field/Field';
import LogoUpload from '../../../components/LogoUpload/LogoUpload';
import Modal from '../../../components/Modal/Modal';
import { type CreateTeamData, type TeamRecord } from '../../../hooks/useTeams';
import styles from './Teams.module.scss';

interface FormValues {
  name: string;
  code: string;
  league_id: string | null;
  logo: File | string | null;
  city: string;
  home_arena: string;
  primary_color: string;
  text_color: string;
}

interface Props {
  open: boolean;
  editTarget: TeamRecord | null;
  onClose: () => void;
  addTeam: (data: CreateTeamData) => Promise<boolean>;
  updateTeam: (id: string, data: Partial<CreateTeamData>) => Promise<boolean>;
  uploadLogo: (file: File) => Promise<string | null>;
  /** When set, the team is implicitly linked to this league on save. */
  lockedLeagueId?: string;
}

const TeamFormModal = (props: Props) => {
  const { open, editTarget, onClose, addTeam, updateTeam, uploadLogo, lockedLeagueId } = props;
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      name: '',
      code: '',
      league_id: null,
      logo: null,
      city: '',
      home_arena: '',
      primary_color: '#334155',
      text_color: '#ffffff',
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      name: editTarget?.name ?? '',
      code: editTarget?.code ?? '',
      league_id: lockedLeagueId ?? editTarget?.league_id ?? null,
      logo: editTarget?.logo ?? null,
      city: editTarget?.city ?? '',
      home_arena: editTarget?.home_arena ?? '',
      primary_color: editTarget?.primary_color ?? '#334155',
      text_color: editTarget?.text_color ?? '#ffffff',
    });
  }, [open, editTarget, lockedLeagueId, reset]);

  const onSubmit = handleSubmit(async (data) => {
    let logoUrl: string | null = typeof data.logo === 'string' ? data.logo : null;
    if (data.logo instanceof File) {
      const url = await uploadLogo(data.logo);
      if (!url) return;
      logoUrl = url;
    }
    const payload: CreateTeamData = {
      name: data.name,
      code: data.code,
      logo: logoUrl,
      league_id: data.league_id || null,
      city: data.city || undefined,
      home_arena: data.home_arena || undefined,
      primary_color: data.primary_color,
      text_color: data.text_color,
    };
    const ok = editTarget ? await updateTeam(editTarget.id, payload) : await addTeam(payload);
    if (ok) onClose();
  });

  return (
    <Modal
      open={open}
      title={editTarget ? 'Edit Team' : 'Create Team'}
      onClose={onClose}
    >
      <form
        className={styles.form}
        onSubmit={onSubmit}
      >
        <LogoUpload
          control={control}
          name="logo"
          label="Team Logo"
          disabled={isSubmitting}
        />
        <Field
          label="Name"
          required
          control={control}
          name="name"
          rules={{ required: true }}
          placeholder="e.g. Toronto Maple Leafs"
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
          placeholder="e.g. TOR"
          disabled={isSubmitting}
        />
        <Field
          label="City"
          control={control}
          name="city"
          placeholder="e.g. Toronto"
          disabled={isSubmitting}
        />
        <Field
          label="Home Arena"
          control={control}
          name="home_arena"
          placeholder="e.g. Scotiabank Arena"
          disabled={isSubmitting}
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
        <div className={styles.formActions}>
          <Button
            type="button"
            variant="outlined"
            intent="neutral"
            disabled={isSubmitting}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Team'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default TeamFormModal;
