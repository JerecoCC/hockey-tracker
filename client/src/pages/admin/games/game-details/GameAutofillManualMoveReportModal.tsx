import Badge from '@/components/Badge/Badge';
import Modal from '@/components/Modal/Modal';
import Table, { type Column } from '@/components/Table/Table';
import type { GameAutofillManualMoveReport, GameAutofillManualPlayerMove } from './gameAutofillTypes';
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

const columns: Column<GameAutofillManualPlayerMove>[] = [
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

const getMoveRowKey = (gameId: string, move: GameAutofillManualPlayerMove) =>
  [
    gameId,
    move.leaguePlayerNumber || move.playerName,
    move.fromTeamCode || 'unassigned',
    move.toTeamCode || 'unassigned',
  ].join('-');

const GameAutofillManualMoveReportModal = ({ open, reports, onClose }: Props) => (
  <Modal
    open={open}
    title="Manual Player Moves"
    onClose={onClose}
    cancelLabel="Close"
    size="lg"
  >
    <div className={styles.report}>
      <p className={styles.intro}>
        Move these players manually, then run auto-fill again for the skipped game.
      </p>
      <div className={styles.games}>
        {reports.map((report) => (
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
            <Table
              columns={columns}
              data={report.moves}
              rowKey={(move) => getMoveRowKey(report.gameId, move)}
              minWidth={640}
            />
          </section>
        ))}
      </div>
    </div>
  </Modal>
);

export default GameAutofillManualMoveReportModal;
