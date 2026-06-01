import { type ReactNode, useEffect } from 'react';
import { useWatch, type Control, type UseFormSetValue } from 'react-hook-form';
import BulkCreateModal from '@/components/BulkCreateModal/BulkCreateModal';
import Field from '@/components/Field/Field';
import useTeams from '@/hooks/useTeams';
import { type TeamPlayerRecord } from '@/hooks/useTeamPlayers';
import { ACQUISITION_TYPE_OPTIONS } from '../players/StintEditModal';
import tradeStyles from './MovePlayerModal.module.scss';

const EMPTY_ROW = { player_id: '', jersey_number: '' };

interface RowValues {
  player_id: string;
  jersey_number: string;
}

interface FormValues {
  to_team_id: string | null;
  trade_date: string;
  acquisition_type: string;
  players: RowValues[];
}

interface TradeRowProps {
  index: number;
  control: Control<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  playerOptions: { value: string; label: string }[];
  players: TeamPlayerRecord[];
  isSubmitting: boolean;
  deleteButton: ReactNode;
}

const TradeRow = ({
  index,
  control,
  setValue,
  playerOptions,
  players,
  isSubmitting,
  deleteButton,
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
    <>
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
      {deleteButton}
    </>
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
    acquisitionType?: string,
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

  const teamOptions = teams
    .filter((t) => t.league_id === leagueId && t.id !== teamId)
    .map((t) => ({ value: t.id, label: t.name, logo: t.logo ?? undefined, code: t.code }));

  const playerOptions = players.map((p) => ({
    value: p.id,
    label: `${p.first_name} ${p.last_name}${p.jersey_number != null ? ` (#${p.jersey_number})` : ''}`,
  }));

  return (
    <BulkCreateModal<FormValues, RowValues>
      open={open}
      title="Trade Players"
      size="lg"
      onClose={onClose}
      formId="bulk-trade-form"
      confirmIcon="swap_horiz"
      confirmDisabled={!seasonId}
      createDefaultValues={() => ({
        to_team_id: null,
        trade_date: '',
        acquisition_type: 'trade',
        players: [{ ...EMPTY_ROW }],
      })}
      rowArrayName="players"
      createRow={() => ({ ...EMPTY_ROW })}
      columnsTemplate="6rem 1fr"
      headerCells={[{ label: 'Jersey #' }, { label: 'Player', required: true }]}
      addRowLabel="Add Player"
      addRowDisabled={({ rowCount }) => players.length === 0 || rowCount >= players.length}
      itemLabel="player"
      getConfirmLabel={(count, isSubmitting) =>
        isSubmitting ? 'Trading…' : `Trade ${count} Player${count !== 1 ? 's' : ''}`
      }
      shouldConfirmRemove={(row) => !!(row.player_id || row.jersey_number)}
      getRemoveConfirmBody={() => 'Are you sure you want to remove this player from the list?'}
      renderBeforeRows={({ control, isSubmitting }) => (
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
          <Field
            type="select"
            label="Move Type"
            control={control}
            name="acquisition_type"
            options={ACQUISITION_TYPE_OPTIONS}
            disabled={isSubmitting}
          />
        </div>
      )}
      onSubmitForm={async (data) => {
        if (!seasonId || !data.to_team_id) return false;
        const payload = data.players
          .filter((r) => r.player_id)
          .map((r) => ({
            playerId: r.player_id,
            jerseyNumber: r.jersey_number ? parseInt(r.jersey_number, 10) : null,
          }));
        if (payload.length === 0) return false;
        return bulkTradePlayers(payload, seasonId, data.to_team_id, data.trade_date, data.acquisition_type || 'trade');
      }}
      renderRow={({ index, control, setValue, rows, isSubmitting, deleteButton }) => {
        const pickedIds = new Set(
          rows
            .filter((_, i) => i !== index)
            .map((r) => r.player_id)
            .filter(Boolean),
        );
        const availableOptions = playerOptions.filter((o) => !pickedIds.has(o.value));

        return (
          <TradeRow
            index={index}
            control={control}
            setValue={setValue}
            playerOptions={availableOptions}
            players={players}
            isSubmitting={isSubmitting}
            deleteButton={deleteButton}
          />
        );
      }}
    />
  );
};

export default BulkTradeModal;
