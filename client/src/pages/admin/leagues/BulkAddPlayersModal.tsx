import { useRef } from 'react';
import BulkCreateModal, {
  type BulkCreateRowRenderProps,
} from '@jerecocc/tracker-ui/components/BulkCreateModal/BulkCreateModal';
import { ControlledInputField, ControlledSelectField } from '@/components/form/ControlledFields';
import useBackgroundModalAction from '@/hooks/useBackgroundModalAction';
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
  // The submitted rows, kept until they're saved: the players are created behind a progress toast
  // with the modal hidden, and if that fails the modal reopens with these rows restored, ready to
  // save again.
  const draftRef = useRef<{ rows: RowValues[] } | null>(null);
  const closeModal = () => {
    draftRef.current = null;
    onClose();
  };
  const { hidden, runSettled } = useBackgroundModalAction({
    target: open ? 'bulk' : null,
    onDone: closeModal,
  });

  return (
    <BulkCreateModal<{ rows: RowValues[] }, RowValues>
      createDefaultValues={() => ({ rows: [{ ...EMPTY_ROW }] })}
      restoreValues={draftRef.current ?? undefined}
      rowArrayName="rows"
      open={open && !hidden}
      title="Bulk Create Players"
      size="lg"
      onClose={closeModal}
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
      onSubmit={(data) => {
        draftRef.current = data;
        const payload: BulkPlayerInput[] = data.rows.map((row) => ({
          first_name: row.first_name,
          last_name: row.last_name,
          position: row.position as PlayerPosition,
          shoots: row.shoots as PlayerShoots,
        }));
        const count = payload.length;
        void runSettled(() => bulkAddPlayers(payload), {
          pending: `Creating ${count} player${count === 1 ? '' : 's'}…`,
        });
        // The modal hides and closes itself, so it shouldn't reset or close here.
        return Promise.resolve(false);
      }}
      renderRow={(props) => <PlayerRowFields {...props} />}
    />
  );
};

export default BulkAddPlayersModal;
