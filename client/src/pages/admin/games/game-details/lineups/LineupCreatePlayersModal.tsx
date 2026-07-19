import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import BulkCreateModal from '@jerecocc/tracker-ui/components/BulkCreateModal/BulkCreateModal';
import Field from '@jerecocc/tracker-ui/components/Field/Field';
import Icon from '@jerecocc/tracker-ui/components/Icon/Icon';
import { type PlayerPosition } from '@/hooks/useLeaguePlayers';
import ResponsiveList from '@/shared/ResponsiveList/ResponsiveList';
import styles from './LineupCreatePlayersModal.module.scss';

import { API, authHeaders } from '@/lib/apiClient';

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
  leagueId: string;
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
  /** Pre-fill form rows with these jersey numbers when the modal opens */
  initialJerseyNumbers?: number[];
  /** Allow callers managing team-season rosters to exceed the game roster cap. */
  allowRosterOverflow?: boolean;
}

const buildRowWarnings = (rows: RowValues[] = [], existingRoster: ExistingRosterEntry[]) => {
  const rosterNameMap = new Map(
    existingRoster.map((r) => [
      `${r.first_name.trim().toLowerCase()} ${r.last_name.trim().toLowerCase()}`,
      r,
    ]),
  );
  const rosterJerseyMap = new Map(
    existingRoster.filter((r) => r.jersey_number != null).map((r) => [r.jersey_number!, r]),
  );

  const seenNames = new Map<string, number>();
  const seenJerseys = new Map<number, number>();

  return rows.map((row) => {
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
};

const LineupCreatePlayersModal = ({
  open,
  onClose,
  teamId,
  leagueId,
  seasonId,
  teamName,
  existingCount,
  existingGoalieCount,
  existingRoster = [],
  createAndRosterPlayers,
  onPlayersCreated,
  initialJerseyNumbers,
  allowRosterOverflow = false,
}: Props) => {
  const [duplicateErrors, setDuplicateErrors] = useState<string[]>([]);
  const [crossTeamWarnings, setCrossTeamWarnings] = useState<string[]>([]);
  const crossTeamConfirmedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setDuplicateErrors([]);
    setCrossTeamWarnings([]);
    crossTeamConfirmedRef.current = false;
  }, [open]);

  const handleClose = () => {
    setDuplicateErrors([]);
    setCrossTeamWarnings([]);
    crossTeamConfirmedRef.current = false;
    onClose();
  };

  const handleCreateAnyway = () => {
    crossTeamConfirmedRef.current = true;
    setCrossTeamWarnings([]);
    document.getElementById('lineup-create-players-form')?.requestSubmit();
  };

  const getDefaultValues = (): FormValues => ({
    players:
      initialJerseyNumbers && initialJerseyNumbers.length > 0
        ? initialJerseyNumbers.map((n) => ({ ...EMPTY_ROW, jersey_number: String(n) }))
        : [{ ...EMPTY_ROW }],
  });

  return (
    <BulkCreateModal<FormValues, RowValues>
      open={open}
      title={`Create Players for ${teamName}`}
      size="lg"
      disableBackdropClose
      onClose={handleClose}
      formId="lineup-create-players-form"
      createDefaultValues={getDefaultValues}
      rowArrayName="players"
      createRow={() => ({ ...EMPTY_ROW })}
      columnsTemplate="4rem 1fr 1fr 1fr"
      headerCells={[
        { label: '#' },
        { label: 'Position', required: true },
        { label: 'First Name', required: true },
        { label: 'Last Name', required: true },
      ]}
      requiredRowFields={['position', 'first_name', 'last_name']}
      addRowLabel="Add Player"
      addRowDisabled={
        allowRosterOverflow ? undefined : ({ rowCount }) => rowCount >= MAX_ROSTER - existingCount
      }
      addRowHint={
        allowRosterOverflow
          ? ({ rowCount }) => `${existingCount + rowCount} players`
          : ({ rowCount }) => `${existingCount + rowCount} / ${MAX_ROSTER} players`
      }
      itemLabel="player"
      confirmIcon="person_edit"
      getConfirmLabel={(count, isSubmitting) =>
        isSubmitting ? 'Creating…' : `Create ${count} Player${count !== 1 ? 's' : ''}`
      }
      shouldConfirmRemove={(row) => !!(row.first_name || row.last_name || row.position)}
      getRemoveConfirmBody={() => 'This row has data. Are you sure you want to remove it?'}
      onSubmit={async (data) => {
        // ── Duplicate validation ──────────────────────────────────────────────────
        const errors: string[] = [];

        // Normalise existing roster jerseys for quick lookup.
        // Names are intentionally not checked — players can legitimately share the
        // same first and last name (e.g. namesakes, common names).
        const rosterJerseys = new Set(
          existingRoster.filter((r) => r.jersey_number != null).map((r) => r.jersey_number!),
        );

        // Track jersey numbers within the form to catch row-vs-row duplicates.
        const formJerseys = new Set<number>();

        for (const row of data.players) {
          const jerseyNum = row.jersey_number !== '' ? Number(row.jersey_number) : null;

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
          return false;
        }
        setDuplicateErrors([]);

        // Cross-team duplicate check (soft warning, bypass-able).
        if (!crossTeamConfirmedRef.current) {
          try {
            const { data: allPlayers } = await axios.get<
              Array<{
                first_name: string;
                last_name: string;
                team_id?: string | null;
                team_name?: string | null;
                is_prospect?: boolean;
              }>
            >(`${API}/admin/players`, {
              headers: authHeaders(),
              params: { league_id: leagueId, season_id: seasonId, include_prospects: 'true' },
            });

            const formRowsByName = new Map(
              data.players.map((r) => [
                `${r.first_name.trim().toLowerCase()} ${r.last_name.trim().toLowerCase()}`,
                r,
              ]),
            );
            const sameTeamErrors: string[] = [];
            const warnings: string[] = [];
            const sameTeamMatchedNames = new Set<string>();
            const warningMatchedNames = new Set<string>();

            for (const p of allPlayers) {
              const key = `${p.first_name.trim().toLowerCase()} ${p.last_name.trim().toLowerCase()}`;
              const formRow = formRowsByName.get(key);

              if (!formRow) {
                continue;
              }

              const fullName = `${formRow.first_name.trim()} ${formRow.last_name.trim()}`;
              if (p.team_id === teamId) {
                if (!sameTeamMatchedNames.has(key)) {
                  const rosterLabel = p.is_prospect ? 'prospects' : 'roster';
                  sameTeamErrors.push(
                    `"${fullName}" already exists on this team's ${rosterLabel}.`,
                  );
                  sameTeamMatchedNames.add(key);
                }
                continue;
              }

              if (!warningMatchedNames.has(key)) {
                const rosterLabel = p.is_prospect ? 'prospects' : 'roster';
                const teamLabel = p.team_name ?? 'another team';
                warnings.push(`"${fullName}" already exists on ${teamLabel}'s ${rosterLabel}.`);
                warningMatchedNames.add(key);
              }
            }
            if (sameTeamErrors.length > 0) {
              setDuplicateErrors(sameTeamErrors);
              return false;
            }
            if (warnings.length > 0) {
              setCrossTeamWarnings(warnings);
              return false;
            }
          } catch {
            // Non-fatal — proceed without the cross-team check if the fetch fails
          }
        }
        setCrossTeamWarnings([]);

        const payload = data.players.map((row) => ({
          first_name: row.first_name,
          last_name: row.last_name,
          position: row.position as PlayerPosition,
          jersey_number: row.jersey_number !== '' ? Number(row.jersey_number) : null,
        }));
        const createdIds = await createAndRosterPlayers(teamId, seasonId, payload);
        if (createdIds === null) return false;
        if (createdIds.length > 0 && onPlayersCreated) {
          await onPlayersCreated(createdIds);
        }
        return true;
      }}
      renderRow={({ index, control, rows, isSubmitting, autoFocus, deleteButton }) => {
        const goaliesInForm = rows.filter((p) => p?.position === 'G').length;
        const goalieCapReached = existingGoalieCount + goaliesInForm >= MAX_GOALIES;
        const rowIsGoalie = rows[index]?.position === 'G';
        const positionOptions =
          goalieCapReached && !rowIsGoalie
            ? POSITION_OPTIONS.filter((o) => o.value !== 'G')
            : POSITION_OPTIONS;
        const warn = buildRowWarnings(rows, existingRoster)[index];

        return (
          <>
            <Field
              control={control}
              name={`players.${index}.jersey_number`}
              placeholder="—"
              disabled={isSubmitting}
              autoFocus={autoFocus}
              inputMode="numeric"
              maxLength={2}
              transform={(val) => val.replace(/[^0-9]/g, '').slice(0, 2)}
            />
            <Field
              type="select"
              control={control}
              name={`players.${index}.position`}
              options={positionOptions}
              required
              rules={{ required: true }}
              placeholder="Position"
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
              control={control}
              name={`players.${index}.last_name`}
              required
              rules={{ required: true }}
              placeholder="Last name"
              disabled={isSubmitting}
            />
            {deleteButton}
            {(warn?.name || warn?.jersey) && (
              <div
                className={styles.rowWarnings}
                style={{ gridColumn: '1 / -1' }}
              >
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
          </>
        );
      }}
      renderAfterRows={({ formState }) => (
        <>
          {formState.isSubmitted && formState.errors.players && (
            <p className={styles.formError}>Please fill in all required fields before saving.</p>
          )}
          {duplicateErrors.length > 0 && (
                  <ResponsiveList className={styles.duplicateErrors}>
              {duplicateErrors.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
                  </ResponsiveList>
          )}
          {crossTeamWarnings.length > 0 && (
            <div className={styles.crossTeamWarnings}>
                  <ResponsiveList className={styles.crossTeamWarningList}>
                {crossTeamWarnings.map((msg, i) => (
                  <li key={i}>
                    <Icon
                      name="warning"
                      size="0.85em"
                    />
                    {msg}
                  </li>
                ))}
                  </ResponsiveList>
              <p className={styles.crossTeamWarningNote}>
                This may be the same person. You can create a new player record or go back and add
                the existing player from the season roster instead.
              </p>
              <div className={styles.crossTeamWarningActions}>
                <Button
                  type="button"
                  variant="outlined"
                  intent="warning"
                  onClick={handleCreateAnyway}
                >
                  Create Anyway
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    />
  );
};

export default LineupCreatePlayersModal;
