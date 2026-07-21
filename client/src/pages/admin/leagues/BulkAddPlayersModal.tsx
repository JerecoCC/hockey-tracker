import BulkCreateModal, {
  type BulkCreateRowRenderProps,
} from '@jerecocc/tracker-ui/components/BulkCreateModal/BulkCreateModal';
import { ControlledInputField, ControlledSelectField } from '@/components/form/ControlledFields';
import {
  type BulkPlayerInput,
  type PlayerPosition,
  type PlayerShoots,
} from '@/hooks/useLeaguePlayers';

const POSITION_OPTIONS = [
  { value: 'C', label: 'Center' },
  { value: 'LW', label: 'Left Wing' },
  { value: 'RW', label: 'Right Wing' },
  { value: 'F', label: 'Forward' },
  { value: 'D', label: 'Defense' },
  { value: 'LD', label: 'Left Defense' },
  { value: 'RD', label: 'Right Defense' },
  { value: 'G', label: 'Goalie' },
];

const SHOOTS_OPTIONS = [
  { value: 'L', label: 'Left' },
  { value: 'R', label: 'Right' },
];

const EMPTY_ROW = {
  first_name: '',
  last_name: '',
  position: '' as PlayerPosition | '',
  shoots: '' as PlayerShoots | '',
};

interface RowValues {
  first_name: string;
  last_name: string;
  position: PlayerPosition | '';
  shoots: PlayerShoots | '';
}

interface Props {
  open: boolean;
  onClose: () => void;
  bulkAddPlayers: (players: BulkPlayerInput[]) => Promise<boolean>;
}

const PlayerRowFields = ({
  index,
  control,
  isSubmitting,
  autoFocus,
  deleteButton,
}: BulkCreateRowRenderProps<{ rows: RowValues[] }, RowValues>) => (
  <>
    <ControlledSelectField
      control={control}
      name={`rows.${index}.position`}
      options={POSITION_OPTIONS}
      required
      rules={{ required: true }}
      placeholder="Position"
      disabled={isSubmitting}
      autoFocus={autoFocus}
    />
    <ControlledInputField
      control={control}
      name={`rows.${index}.first_name`}
      required
      rules={{ required: true }}
      placeholder="First name"
      disabled={isSubmitting}
    />
    <ControlledInputField
      control={control}
      name={`rows.${index}.last_name`}
      required
      rules={{ required: true }}
      placeholder="Last name"
      disabled={isSubmitting}
    />
    <ControlledSelectField
      control={control}
      name={`rows.${index}.shoots`}
      options={SHOOTS_OPTIONS}
      required
      rules={{ required: true }}
      placeholder="Shoots"
      disabled={isSubmitting}
    />
    {deleteButton}
  </>
);

const BulkAddPlayersModal = ({ open, onClose, bulkAddPlayers }: Props) => {
  return (
    <BulkCreateModal<{ rows: RowValues[] }, RowValues>
      createDefaultValues={() => ({ rows: [{ ...EMPTY_ROW }] })}
      rowArrayName="rows"
      open={open}
      title="Bulk Create Players"
      size="lg"
      onClose={onClose}
      formId="bulk-add-players-form"
      createRow={() => ({ ...EMPTY_ROW })}
      columnsTemplate="1fr 1fr 1fr 1fr"
      headerCells={[
        { label: 'Position', required: true },
        { label: 'First Name', required: true },
        { label: 'Last Name', required: true },
        { label: 'Shoots', required: true },
      ]}
      requiredRowFields={['position', 'first_name', 'last_name', 'shoots']}
      addRowLabel="Create Player"
      itemLabel="player"
      getConfirmLabel={(count, isSubmitting) =>
        isSubmitting ? 'Saving…' : `Save ${count} Player${count !== 1 ? 's' : ''}`
      }
      shouldConfirmRemove={(row) =>
        !!(row.first_name || row.last_name || row.position || row.shoots)
      }
      getRemoveConfirmBody={() => 'Are you sure you want to remove this player from the list?'}
      onSubmit={async (data) => {
        const payload: BulkPlayerInput[] = data.rows.map((row) => ({
          first_name: row.first_name,
          last_name: row.last_name,
          position: row.position as PlayerPosition,
          shoots: row.shoots as PlayerShoots,
        }));
        return bulkAddPlayers(payload);
      }}
      renderRow={(props) => <PlayerRowFields {...props} />}
    />
  );
};

export default BulkAddPlayersModal;
