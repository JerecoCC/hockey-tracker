import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../../../components/Button/Button';
import Field from '../../../components/Field/Field';
import LogoUpload from '../../../components/LogoUpload/LogoUpload';
import Modal from '../../../components/Modal/Modal';
import { type SelectOption } from '../../../components/Select/Select';
import { type CreateTeamData, type TeamRecord } from '../../../hooks/useTeams';
import styles from './Teams.module.scss';

interface FormValues {
  name: string;
  code: string;
  league_id: string | null;
  logo: File | string | null;
}

interface Props {
  open: boolean;
  editTarget: TeamRecord | null;
  leagueOptions: SelectOption[];
  onClose: () => void;
  addTeam: (data: CreateTeamData) => Promise<boolean>;
  updateTeam: (id: string, data: Partial<CreateTeamData>) => Promise<boolean>;
  uploadLogo: (file: File) => Promise<string | null>;
  /** When set, the league field is pre-filled with this ID and locked. */
  lockedLeagueId?: string;
}

const TeamFormModal = ({
  open,
  editTarget,
  leagueOptions,
  onClose,
  addTeam,
  updateTeam,
  uploadLogo,
  lockedLeagueId,
}: Props) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({ defaultValues: { name: '', code: '', league_id: null, logo: null } });

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
      title={editTarget ? 'Edit Team' : 'Add Team'}
      onClose={onClose}
    >
      <form
        className={styles.form}
        onSubmit={onSubmit}
      >
        <LogoUpload
          control={control}
          name="logo"
          label="Add Team Logo"
        />
        <Field
          label="Name"
          required
          control={control}
          name="name"
          rules={{ required: true }}
          placeholder="e.g. Toronto Maple Leafs"
          autoFocus
        />
        <Field
          label="Code"
          required
          control={control}
          name="code"
          rules={{ required: true }}
          transform={(v) => v.toUpperCase()}
          placeholder="e.g. TOR"
        />
        <Field
          label="League"
          required
          type="select"
          control={control}
          name="league_id"
          rules={{ required: true }}
          options={leagueOptions}
          placeholder="— Select a league —"
          disabled={!!lockedLeagueId}
        />
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
            {isSubmitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Team'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default TeamFormModal;
