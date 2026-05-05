import { useEffect, useState } from 'react';
import {
  useForm,
  useFieldArray,
  useWatch,
  type Control,
  type UseFormSetValue,
} from 'react-hook-form';
import Button from '@/components/Button/Button';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import Field from '@/components/Field/Field';
import Icon from '@/components/Icon/Icon';
import Modal from '@/components/Modal/Modal';
import useTeams from '@/hooks/useTeams';
import { type TeamPlayerRecord } from '@/hooks/useTeamPlayers';
import bulkStyles from '../leagues/BulkAddPlayersModal.module.scss';
import tradeStyles from './TradePlayerModal.module.scss';

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_ROW = { player_id: '', jersey_number: '' };

interface RowValues {
  player_id: string;
  jersey_number: string;
}

interface FormValues {
  to_team_id: string | null;
  trade_date: string;
  players: RowValues[];
}

interface TradeRowProps {
  index: number;
  control: Control<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  playerOptions: { value: string; label: string }[];
  players: TeamPlayerRecord[];
  isSubmitting: boolean;
  canDelete: boolean;
  onDelete: () => void;
}

const TradeRow = ({
  index,
  control,
  setValue,
  playerOptions,
  players,
  isSubmitting,
  canDelete,
  onDelete,
}: TradeRowProps) => {
  const selectedPlayerId = useWatch({ control, name: `players.${index}.player_id` });

  useEffect(() => {
    const player = players.find((p) => p.id === selectedPlayerId);
    setValue(
      `players.${index}.jersey_number`,
      player?.jersey_number != null ? String(player.jersey_number) : '',
    );
  }, [selectedPlayerId, index, players, setValue]);

  return (
    <div
      className={bulkStyles.playerRow}
      style={{ gridTemplateColumns: '6rem 1fr 2rem' }}
    >
      <Field
        control={control}
        name={`players.${index}.jersey_number`}
        placeholder="#"
        disabled={isSubmitting}
      />
      <Field
        type="select"
        control={control}
        name={`players.${index}.player_id`}
        options={playerOptions}
        required
        rules={{ required: true }}
        placeholder="Select player…"
        searchable
        disabled={isSubmitting}
      />
      <button
        type="button"
        className={bulkStyles.deleteBtn}
        onClick={onDelete}
        disabled={isSubmitting}
        style={{ visibility: canDelete ? undefined : 'hidden' }}
        aria-label="Remove player"
      >
        <Icon
          name="delete"
          size="1em"
        />
      </button>
    </div>
  );
};

interface Props {
  open: boolean;
  onClose: () => void;
  players: TeamPlayerRecord[];
  teamId: string;
  leagueId: string;
  seasonId: string | null;
  bulkTradePlayers: (
    playerRows: { playerId: string; jerseyNumber: number | null }[],
    seasonId: string,
    toTeamId: string,
    tradeDate: string,
  ) => Promise<boolean>;
}

const BulkTradeModal = ({
  open,
  onClose,
  players,
  teamId,
  leagueId,
  seasonId,
  bulkTradePlayers,
}: Props) => {
  const { teams } = useTeams();
  const [confirmRemoveIndex, setConfirmRemoveIndex] = useState<number | null>(null);

  const teamOptions = teams
    .filter((t) => t.league_id === leagueId && t.id !== teamId)
    .map((t) => ({ value: t.id, label: t.name, logo: t.logo ?? undefined, code: t.code }));

  const playerOptions = players.map((p) => ({
    value: p.id,
    label: `${p.first_name} ${p.last_name}${p.jersey_number != null ? ` (#${p.jersey_number})` : ''}`,
  }));

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { to_team_id: null, trade_date: '', players: [{ ...EMPTY_ROW }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'players' });
  const watchedRows = useWatch({ control, name: 'players' });

  const handleClose = () => {
    reset({ to_team_id: null, trade_date: '', players: [{ ...EMPTY_ROW }] });
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    reset({ to_team_id: null, trade_date: '', players: [{ ...EMPTY_ROW }] });
  }, [open, reset]);

  const isRowDirty = (index: number) =>
    !!(watchedRows?.[index]?.player_id || watchedRows?.[index]?.jersey_number);

  const handleDeleteClick = (index: number) => {
    if (isRowDirty(index)) {
      setConfirmRemoveIndex(index);
    } else {
      remove(index);
    }
  };

  const onSubmit = handleSubmit(async (data) => {
    if (!seasonId || !data.to_team_id) return;
    const payload = data.players
      .filter((r) => r.player_id)
      .map((r) => ({
        playerId: r.player_id,
        jerseyNumber: r.jersey_number ? parseInt(r.jersey_number, 10) : null,
      }));
    if (payload.length === 0) return;
    const ok = await bulkTradePlayers(payload, seasonId, data.to_team_id, data.trade_date);
    if (ok) handleClose();
  });

  return (
    <>
      <Modal
        open={open}
        title="Trade Players"
        onClose={handleClose}
        size="lg"
        confirmLabel={
          isSubmitting
            ? 'Trading…'
            : `Trade ${fields.length} Player${fields.length !== 1 ? 's' : ''}`
        }
        confirmIcon="swap_horiz"
        confirmForm="bulk-trade-form"
        confirmDisabled={isSubmitting || !seasonId}
        busy={isSubmitting}
      >
        <form
          id="bulk-trade-form"
          onSubmit={onSubmit}
        >
          <div className={tradeStyles.form}>
            <div className={tradeStyles.row}>
              <Field
                type="select"
                label="Trade To"
                required
                control={control}
                name="to_team_id"
                options={teamOptions}
                placeholder="Select destination team…"
                searchable
                rules={{ required: true }}
                disabled={isSubmitting}
              />
              <Field
                type="datepicker"
                label="Trade Date"
                required
                control={control}
                name="trade_date"
                rules={{ required: true }}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div
            className={bulkStyles.headerRow}
            style={{ gridTemplateColumns: '6rem 1fr 2rem', marginTop: '1.5rem' }}
          >
            <span className={bulkStyles.headerCell}>Jersey #</span>
            <span className={bulkStyles.headerCell}>Player</span>
            <span />
          </div>

          <div className={bulkStyles.playerList}>
            {fields.map((field, index) => {
              const pickedIds = new Set(
                watchedRows
                  ?.filter((_, i) => i !== index)
                  .map((r) => r.player_id)
                  .filter(Boolean),
              );
              const availableOptions = playerOptions.filter((o) => !pickedIds.has(o.value));
              return (
                <TradeRow
                  key={field.id}
                  index={index}
                  control={control}
                  setValue={setValue}
                  playerOptions={availableOptions}
                  players={players}
                  isSubmitting={isSubmitting}
                  canDelete={fields.length > 1}
                  onDelete={() => handleDeleteClick(index)}
                />
              );
            })}
          </div>

          <div className={bulkStyles.addRow}>
            <Button
              type="button"
              variant="ghost"
              intent="neutral"
              icon="add"
              size="sm"
              disabled={isSubmitting || fields.length >= players.length}
              onClick={() => append({ ...EMPTY_ROW })}
            >
              Add Player
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={confirmRemoveIndex !== null}
        title="Remove Player"
        body="Are you sure you want to remove this player from the list?"
        confirmLabel="Remove"
        confirmIcon="delete"
        variant="danger"
        onCancel={() => setConfirmRemoveIndex(null)}
        onConfirm={() => {
          if (confirmRemoveIndex !== null) {
            remove(confirmRemoveIndex);
            setConfirmRemoveIndex(null);
          }
        }}
      />
    </>
  );
};

export default BulkTradeModal;
