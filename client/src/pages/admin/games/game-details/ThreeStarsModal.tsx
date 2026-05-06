import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import Modal from '@/components/Modal/Modal';
import { type GameRosterEntry } from '@/hooks/useGameRoster';

interface StarPayload {
  star1: string;
  star2: string;
  star3: string;
}

interface FormValues {
  star1: string;
  star2: string;
  star3: string;
}

interface TeamMeta {
  id: string;
  code: string;
  logo: string | null;
  primaryColor: string;
  textColor: string;
}

interface Props {
  open: boolean;
  /** true = editing stars on a finished game; false = end-game award flow */
  editMode: boolean;
  roster: GameRosterEntry[];
  busy: boolean;
  awayTeam: TeamMeta;
  homeTeam: TeamMeta;
  /** Pre-fill values used when editMode is true */
  initialStars?: { star1: string; star2: string; star3: string };
  onClose: () => void;
  /** Called in edit mode — save updated stars */
  onSave: (payload: StarPayload) => Promise<boolean>;
  /** Called in end-game mode — finalise the game with 3 stars */
  onEndGame: (payload: StarPayload) => Promise<boolean>;
}

const ThreeStarsModal = ({
  open,
  editMode,
  roster,
  busy,
  awayTeam,
  homeTeam,
  initialStars,
  onClose,
  onSave,
  onEndGame,
}: Props) => {
  const { control, handleSubmit, reset, watch } = useForm<FormValues>({
    defaultValues: { star1: '', star2: '', star3: '' },
  });

  useEffect(() => {
    if (open) {
      reset({
        star1: editMode && initialStars ? initialStars.star1 : '',
        star2: editMode && initialStars ? initialStars.star2 : '',
        star3: editMode && initialStars ? initialStars.star3 : '',
      });
    }
  }, [open, editMode, initialStars, reset]);

  const [star1, star2, star3] = watch(['star1', 'star2', 'star3']);
  const canConfirm = !!star1 && !!star2 && !!star3;

  const teamMap: Record<string, TeamMeta> = {
    [awayTeam.id]: awayTeam,
    [homeTeam.id]: homeTeam,
  };

  const allPlayerOptions = roster.map((e) => {
    const team = teamMap[e.team_id];
    return {
      value: e.player_id,
      label:
        e.jersey_number != null
          ? `#${e.jersey_number} ${e.first_name} ${e.last_name}`
          : `${e.first_name} ${e.last_name}`,
      logo: team?.logo ?? undefined,
      code: team?.code,
    };
  });

  const onSubmit = handleSubmit(async (data) => {
    const payload: StarPayload = { star1: data.star1, star2: data.star2, star3: data.star3 };
    if (editMode) {
      const ok = await onSave(payload);
      if (ok) onClose();
    } else {
      const ok = await onEndGame(payload);
      if (ok) onClose();
    }
  });

  return (
    <Modal
      open={open}
      title={editMode ? 'Edit Three Stars' : 'End Game — 3 Stars'}
      onClose={onClose}
      confirmLabel={editMode ? (busy ? 'Saving…' : 'Save') : 'End Game'}
      confirmIcon={editMode ? 'save' : undefined}
      confirmDisabled={!canConfirm || busy}
      confirmForm="three-stars-form"
    >
      <form
        id="three-stars-form"
        onSubmit={onSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        <Field
          label="1st Star"
          type="select"
          control={control}
          name="star1"
          options={allPlayerOptions}
          placeholder="— Select player —"
          searchable
          disabled={busy}
        />
        <Field
          label="2nd Star"
          type="select"
          control={control}
          name="star2"
          options={allPlayerOptions}
          placeholder="— Select player —"
          searchable
          disabled={busy}
        />
        <Field
          label="3rd Star"
          type="select"
          control={control}
          name="star3"
          options={allPlayerOptions}
          placeholder="— Select player —"
          searchable
          disabled={busy}
        />
      </form>
    </Modal>
  );
};

export default ThreeStarsModal;
