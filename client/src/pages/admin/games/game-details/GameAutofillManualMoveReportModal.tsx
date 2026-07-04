import Badge from '@/components/Badge/Badge';
import Modal from '@/components/Modal/Modal';
import Table, { type Column } from '@/components/Table/Table';
import type {
  GameAutofillManualJerseyChange,
  GameAutofillManualMoveReport,
  GameAutofillManualPlayerMove,
} from './gameAutofillTypes';
import styles from './GameAutofillManualMoveReportModal.module.scss';

interface Props {
  open: boolean;
  reports: GameAutofillManualMoveReport[];
  onClose: () => void;
}

function formatTeam(code: string | null | undefined, name: string | null | undefined) {
  if (!code && !name) return 'Unassigned';
  if (!code) return name ?? 'Unassigned';
  if (!name || name === code) return code;
  return `${code} - ${name}`;
}

function formatPlayerMeta(move: GameAutofillManualPlayerMove) {
  return [
    move.jerseyNumber != null ? `#${move.jerseyNumber}` : null,
    move.position,
  ].filter(Boolean).join(' / ');
}

function formatJersey(value: number | null | undefined) {
  return value == null ? '-' : `#${value}`;
}

function formatConflict(change: GameAutofillManualJerseyChange) {
  if (!change.conflictingPlayerName && !change.conflictingLeaguePlayerNumber) return '-';
  return [
    change.conflictingPlayerName,
    change.conflictingLeaguePlayerNumber
      ? `league player number ${change.conflictingLeaguePlayerNumber}`
      : null,
  ].filter(Boolean).join(' / ');
}

const moveColumns: Column<GameAutofillManualPlayerMove>[] = [
  {
    type: 'custom',
    header: 'Player',
    render: (move) => {
      const meta = formatPlayerMeta(move);

      return (
        <div className={styles.playerCell}>
          <strong>{move.playerName}</strong>
          {meta && <span>{meta}</span>}
        </div>
      );
    },
  },
  {
    type: 'custom',
    header: 'League player number',
    render: (move) => move.leaguePlayerNumber || '-',
  },
  {
    type: 'custom',
    header: 'Old team',
    render: (move) => formatTeam(move.fromTeamCode, move.fromTeamName),
  },
  {
    type: 'custom',
    header: 'New team',
    render: (move) => formatTeam(move.toTeamCode, move.toTeamName),
  },
];

const jerseyColumns: Column<GameAutofillManualJerseyChange>[] = [
  {
    type: 'custom',
    header: 'Player',
    render: (change) => (
      <div className={styles.playerCell}>
        <strong>{change.playerName}</strong>
        {change.leaguePlayerNumber && <span>league player number {change.leaguePlayerNumber}</span>}
      </div>
    ),
  },
  {
    type: 'custom',
    header: 'Team',
    render: (change) => formatTeam(change.teamCode, change.teamName),
  },
  {
    type: 'custom',
    header: 'Current number',
    render: (change) => formatJersey(change.currentJerseyNumber),
  },
  {
    type: 'custom',
    header: 'Conflicting number',
    render: (change) => formatJersey(change.conflictingJerseyNumber),
  },
  {
    type: 'custom',
    header: 'Conflicts with',
    render: formatConflict,
  },
];

const getMoveRowKey = (gameId: string, move: GameAutofillManualPlayerMove) =>
  [
    gameId,
    move.leaguePlayerNumber || move.playerName,
    move.fromTeamCode || 'unassigned',
    move.toTeamCode || 'unassigned',
  ].join('-');

const getJerseyChangeRowKey = (gameId: string, change: GameAutofillManualJerseyChange) =>
  [
    gameId,
    change.leaguePlayerNumber || change.playerName,
    change.teamCode,
    change.currentJerseyNumber ?? 'none',
    change.conflictingLeaguePlayerNumber || change.conflictingPlayerName || 'unknown',
  ].join('-');

const GameAutofillManualMoveReportModal = ({ open, reports, onClose }: Props) => (
  <Modal
    open={open}
    title="Manual Player Updates"
    onClose={onClose}
    cancelLabel="Close"
    size="lg"
  >
    <div className={styles.report}>
      <p className={styles.intro}>
        Move these players or update jersey numbers manually, then run auto-fill again for the skipped game.
      </p>
      <div className={styles.games}>
        {reports.map((report) => {
          const jerseyChanges = report.jerseyChanges ?? [];

          return (
            <section
              key={`${report.gameId}-${report.leagueCode}`}
              className={styles.game}
            >
              <div className={styles.gameHeader}>
                <Badge
                  value={report.leagueCode}
                  aria-label={report.leagueCode}
                />
                <strong>{report.gameLabel}</strong>
              </div>

              {report.moves.length > 0 && (
                <div className={styles.reportSection}>
                  <h4>Player moves</h4>
                  <Table
                    columns={moveColumns}
                    data={report.moves}
                    rowKey={(move) => getMoveRowKey(report.gameId, move)}
                    minWidth={640}
                  />
                </div>
              )}

              {jerseyChanges.length > 0 && (
                <div className={styles.reportSection}>
                  <h4>Jersey number changes</h4>
                  <Table
                    columns={jerseyColumns}
                    data={jerseyChanges}
                    rowKey={(change) => getJerseyChangeRowKey(report.gameId, change)}
                    minWidth={720}
                  />
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  </Modal>
);

export default GameAutofillManualMoveReportModal;
