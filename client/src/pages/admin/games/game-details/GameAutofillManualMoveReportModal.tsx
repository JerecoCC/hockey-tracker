import Modal from '@/components/Modal/Modal';
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
              <span className={styles.league}>{report.leagueCode}</span>
              <strong>{report.gameLabel}</strong>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>League player number</th>
                    <th>Old team</th>
                    <th>New team</th>
                  </tr>
                </thead>
                <tbody>
                  {report.moves.map((move) => (
                    <tr
                      key={`${report.gameId}-${move.leaguePlayerNumber ?? move.playerName}-${move.toTeamCode}`}
                    >
                      <td>
                        <div className={styles.playerCell}>
                          <strong>{move.playerName}</strong>
                          {formatPlayerMeta(move) && <span>{formatPlayerMeta(move)}</span>}
                        </div>
                      </td>
                      <td>{move.leaguePlayerNumber || '-'}</td>
                      <td>{formatTeam(move.fromTeamCode, move.fromTeamName)}</td>
                      <td>{formatTeam(move.toTeamCode, move.toTeamName)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  </Modal>
);

export default GameAutofillManualMoveReportModal;
