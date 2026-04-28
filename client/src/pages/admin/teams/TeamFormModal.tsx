import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import LogoUpload from '@/components/LogoUpload/LogoUpload';
import Modal from '@/components/Modal/Modal';
import { type CreateTeamData, type TeamRecord } from '@/hooks/useTeams';
import styles from '@/pages/admin/teams/TeamFormModal.module.scss';

interface FormValues {
  name: string;
  code: string;
  league_id: string | null;
  logo: File | string | null;
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
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      name: editTarget?.name ?? '',
      code: editTarget?.code ?? '',
      league_id: lockedLeagueId ?? editTarget?.league_id ?? null,
      logo: editTarget?.logo ?? null,
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
    };
    const ok = editTarget ? await updateTeam(editTarget.id, payload) : await addTeam(payload);
    if (ok) onClose();
  });

  return (
    <Modal
      open={open}
      title={editTarget ? 'Edit Team' : 'Create Team'}
      onClose={onClose}
      confirmLabel={isSubmitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Team'}
      confirmForm="team-form"
      confirmDisabled={isSubmitting}
      busy={isSubmitting}
    >
      <form
        id="team-form"
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
      </form>
    </Modal>
  );
};

export default TeamFormModal;
