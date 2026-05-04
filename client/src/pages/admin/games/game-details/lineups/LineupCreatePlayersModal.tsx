import { useState, useEffect, useRef, useMemo } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import Button from '@/components/Button/Button';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import Field from '@/components/Field/Field';
import Icon from '@/components/Icon/Icon';
import Modal from '@/components/Modal/Modal';
import { type PlayerPosition } from '@/hooks/useLeaguePlayers';
import styles from './LineupCreatePlayersModal.module.scss';

const POSITION_OPTIONS = [
  { value: 'C', label: 'Center' },
  { value: 'LW', label: 'Left Wing' },
  { value: 'RW', label: 'Right Wing' },
  { value: 'D', label: 'Defense' },
  { value: 'G', label: 'Goalie' },
];

const EMPTY_ROW = {
  first_name: '',
  last_name: '',
  position: '' as PlayerPosition | '',
  jersey_number: '',
};

interface RowValues {
  first_name: string;
  last_name: string;
  position: PlayerPosition | '';
  jersey_number: string;
}

interface FormValues {
  players: RowValues[];
}

type CreateAndRosterFn = (
  teamId: string,
  seasonId: string,
  players: Array<{
    first_name: string;
    last_name: string;
    position: PlayerPosition;
    jersey_number?: number | null;
  }>,
) => Promise<string[] | null>;

const MAX_ROSTER = 23;
const MAX_GOALIES = 3;

export interface ExistingRosterEntry {
  first_name: string;
  last_name: string;
  jersey_number: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  teamId: string;
  seasonId: string;
  teamName: string;
  /** Current number of players already in this team's game roster. */
  existingCount: number;
  /** Number of goalies already in this team's game roster. */
  existingGoalieCount: number;
  /** Existing roster entries used for duplicate validation. */
  existingRoster?: ExistingRosterEntry[];
  createAndRosterPlayers: CreateAndRosterFn;
  /** Called with the IDs of newly created players so caller can add them to the game roster */
  onPlayersCreated?: (playerIds: string[]) => Promise<void>;
}

const LineupCreatePlayersModal = ({
  open,
  onClose,
  teamId,
  seasonId,
  teamName,
  existingCount,
  existingGoalieCount,
  existingRoster = [],
  createAndRosterPlayers,
  onPlayersCreated,
}: Props) => {
  const [confirmRemoveIndex, setConfirmRemoveIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateErrors, setDuplicateErrors] = useState<string[]>([]);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitted },
  } = useForm<FormValues>({
    defaultValues: { players: [{ ...EMPTY_ROW }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'players' });
  const watchedPlayers = useWatch({ control, name: 'players' });

  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Focus first row's jersey input when the modal opens
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      rowRefs.current[0]?.querySelector<HTMLInputElement>('input')?.focus();
    }, 0);
    return () => clearTimeout(id);
  }, [open]);

  // Focus the jersey input of newly appended rows
  const prevFieldsLength = useRef(fields.length);
  useEffect(() => {
    if (fields.length > prevFieldsLength.current) {
      rowRefs.current[fields.length - 1]?.querySelector<HTMLInputElement>('input')?.focus();
    }
    prevFieldsLength.current = fields.length;
  }, [fields.length]);

  const slotsLeft = MAX_ROSTER - existingCount;
  const canAddMore = fields.length < slotsLeft;

  const goaliesInForm = (watchedPlayers ?? []).filter((p) => p?.position === 'G').length;
  const goalieCapReached = existingGoalieCount + goaliesInForm >= MAX_GOALIES;

  const getPositionOptions = (index: number) => {
    const rowIsGoalie = watchedPlayers?.[index]?.position === 'G';
    if (goalieCapReached && !rowIsGoalie) {
      return POSITION_OPTIONS.filter((o) => o.value !== 'G');
    }
    return POSITION_OPTIONS;
  };

  const isRowDirty = (index: number) => {
    const row = watchedPlayers?.[index];
    return !!(row?.first_name || row?.last_name || row?.position);
  };

  // Per-row inline warnings — recomputed live as the user types.
  const rowWarnings = useMemo(() => {
    const rosterNameMap = new Map(
      existingRoster.map((r) => [
        `${r.first_name.trim().toLowerCase()} ${r.last_name.trim().toLowerCase()}`,
        r,
      ]),
    );
    const rosterJerseyMap = new Map(
      existingRoster.filter((r) => r.jersey_number != null).map((r) => [r.jersey_number!, r]),
    );

    const seenNames = new Map<string, number>(); // nameKey → first row index
    const seenJerseys = new Map<number, number>(); // jerseyNum → first row index

    return (watchedPlayers ?? []).map((row) => {
      const result: { name?: string; jersey?: string } = {};
      const fn = row?.first_name?.trim() ?? '';
      const ln = row?.last_name?.trim() ?? '';

      if (fn && ln) {
        const nameKey = `${fn.toLowerCase()} ${ln.toLowerCase()}`;
        const fullName = `${fn} ${ln}`;
        if (rosterNameMap.has(nameKey)) {
          const match = rosterNameMap.get(nameKey)!;
          result.name = `${fullName} is already on this team's roster${match.jersey_number != null ? ` (#${match.jersey_number})` : ''}.`;
        } else if (seenNames.has(nameKey)) {
          result.name = `${fullName} appears more than once.`;
        } else {
          seenNames.set(nameKey, seenNames.size);
        }
      }

      const jerseyNum =
        row?.jersey_number !== '' && row?.jersey_number != null ? Number(row.jersey_number) : null;
      if (jerseyNum != null && !isNaN(jerseyNum)) {
        if (rosterJerseyMap.has(jerseyNum)) {
          const match = rosterJerseyMap.get(jerseyNum)!;
          result.jersey = `#${jerseyNum} is already worn by ${match.first_name} ${match.last_name}.`;
        } else if (seenJerseys.has(jerseyNum)) {
          result.jersey = `#${jerseyNum} appears more than once in this form.`;
        } else {
          seenJerseys.set(jerseyNum, seenJerseys.size);
        }
      }

      return result;
    });
  }, [watchedPlayers, existingRoster]);

  const handleDeleteClick = (index: number) => {
    if (isRowDirty(index)) setConfirmRemoveIndex(index);
    else remove(index);
  };

  const handleClose = () => {
    reset({ players: [{ ...EMPTY_ROW }] });
    setDuplicateErrors([]);
    onClose();
  };

  const onSubmit = handleSubmit(async (data) => {
    // ── Duplicate validation ──────────────────────────────────────────────────
    const errors: string[] = [];

    // Normalise existing roster for quick lookup
    const rosterNames = new Set(
      existingRoster.map(
        (r) => `${r.first_name.trim().toLowerCase()} ${r.last_name.trim().toLowerCase()}`,
      ),
    );
    const rosterJerseys = new Set(
      existingRoster.filter((r) => r.jersey_number != null).map((r) => r.jersey_number!),
    );

    // Also track within the form itself to catch row-vs-row duplicates
    const formNames = new Set<string>();
    const formJerseys = new Set<number>();

    for (const row of data.players) {
      const nameKey = `${row.first_name.trim().toLowerCase()} ${row.last_name.trim().toLowerCase()}`;
      const jerseyNum = row.jersey_number !== '' ? Number(row.jersey_number) : null;

      if (rosterNames.has(nameKey)) {
        errors.push(`"${row.first_name.trim()} ${row.last_name.trim()}" is already in the lineup.`);
      } else if (formNames.has(nameKey)) {
        errors.push(`"${row.first_name.trim()} ${row.last_name.trim()}" appears more than once.`);
      } else {
        formNames.add(nameKey);
      }

      if (jerseyNum != null) {
        if (rosterJerseys.has(jerseyNum)) {
          errors.push(`Jersey #${jerseyNum} is already in use in this lineup.`);
        } else if (formJerseys.has(jerseyNum)) {
          errors.push(`Jersey #${jerseyNum} is listed more than once.`);
        } else {
          formJerseys.add(jerseyNum);
        }
      }
    }

    if (errors.length > 0) {
      setDuplicateErrors(errors);
      return;
    }
    setDuplicateErrors([]);

    // ── Submit ────────────────────────────────────────────────────────────────
    setIsSubmitting(true);
    const payload = data.players.map((row) => ({
      first_name: row.first_name,
      last_name: row.last_name,
      position: row.position as PlayerPosition,
      jersey_number: row.jersey_number !== '' ? Number(row.jersey_number) : null,
    }));
    const createdIds = await createAndRosterPlayers(teamId, seasonId, payload);
    if (createdIds !== null) {
      if (createdIds.length > 0 && onPlayersCreated) {
        await onPlayersCreated(createdIds);
      }
      handleClose();
    }
    setIsSubmitting(false);
  });

  return (
    <>
      <Modal
        open={open}
        title={`Create Players for ${teamName}`}
        size="lg"
        onClose={handleClose}
        confirmLabel={
          isSubmitting ? 'Saving…' : `Save ${fields.length} Player${fields.length !== 1 ? 's' : ''}`
        }
        confirmForm="lineup-create-players-form"
        confirmDisabled={isSubmitting}
        busy={isSubmitting}
      >
        <form
          id="lineup-create-players-form"
          onSubmit={onSubmit}
        >
          <div className={styles.headerRow}>
            <span className={styles.headerCell}>#</span>
            <span className={styles.headerCell}>Last Name</span>
            <span className={styles.headerCell}>First Name</span>
            <span className={styles.headerCell}>Position</span>
            <span />
          </div>

          <div className={styles.playerList}>
            {fields.map((field, index) => {
              const warn = rowWarnings[index];
              return (
                <div
                  key={field.id}
                  className={styles.playerItem}
                >
                  <div
                    className={styles.playerRow}
                    ref={(el) => {
                      rowRefs.current[index] = el;
                    }}
                  >
                    <Field
                      control={control}
                      name={`players.${index}.jersey_number`}
                      placeholder="—"
                      disabled={isSubmitting}
                      inputMode="numeric"
                      maxLength={2}
                      transform={(val) => val.replace(/[^0-9]/g, '').slice(0, 2)}
                    />
                    <Field
                      control={control}
                      name={`players.${index}.last_name`}
                      required
                      rules={{ required: true }}
                      placeholder="Last name"
                      disabled={isSubmitting}
                    />
                    <Field
                      control={control}
                      name={`players.${index}.first_name`}
                      required
                      rules={{ required: true }}
                      placeholder="First name"
                      disabled={isSubmitting}
                    />
                    <Field
                      type="select"
                      control={control}
                      name={`players.${index}.position`}
                      options={getPositionOptions(index)}
                      required
                      rules={{ required: true }}
                      placeholder="Position"
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => handleDeleteClick(index)}
                      disabled={isSubmitting}
                      aria-label="Remove player"
                      style={{ visibility: fields.length === 1 ? 'hidden' : undefined }}
                    >
                      <Icon
                        name="delete"
                        size="1em"
                      />
                    </button>
                  </div>
                  {(warn?.name || warn?.jersey) && (
                    <div className={styles.rowWarnings}>
                      {warn.name && (
                        <p className={styles.rowWarning}>
                          <Icon
                            name="warning"
                            size="0.85em"
                          />
                          {warn.name}
                        </p>
                      )}
                      {warn.jersey && (
                        <p className={styles.rowWarning}>
                          <Icon
                            name="warning"
                            size="0.85em"
                          />
                          {warn.jersey}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className={styles.addRow}>
            <Button
              type="button"
              variant="ghost"
              intent="neutral"
              icon="add"
              size="sm"
              disabled={isSubmitting || !canAddMore}
              onClick={() => append({ ...EMPTY_ROW })}
            >
              Add Player
            </Button>
            <span className={styles.slotCounter}>
              {existingCount + fields.length} / {MAX_ROSTER} players
            </span>
          </div>

          {isSubmitted && errors.players && (
            <p className={styles.formError}>Please fill in all required fields before saving.</p>
          )}
          {duplicateErrors.length > 0 && (
            <ul className={styles.duplicateErrors}>
              {duplicateErrors.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          )}
        </form>
      </Modal>

      <ConfirmModal
        open={confirmRemoveIndex !== null}
        title="Remove player?"
        body="This row has data. Are you sure you want to remove it?"
        confirmLabel="Remove"
        onConfirm={() => {
          if (confirmRemoveIndex !== null) {
            remove(confirmRemoveIndex);
            setConfirmRemoveIndex(null);
          }
        }}
        onCancel={() => setConfirmRemoveIndex(null)}
      />
    </>
  );
};

export default LineupCreatePlayersModal;
