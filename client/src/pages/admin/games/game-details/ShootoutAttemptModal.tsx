import { useState, useEffect } from 'react';
import Icon from '../../../../components/Icon/Icon';
import Modal from '../../../../components/Modal/Modal';
import SegmentedControl from '../../../../components/SegmentedControl/SegmentedControl';
import Select from '../../../../components/Select/Select';
import { type GameRecord } from '../../../../hooks/useGames';
import { type GameRosterEntry } from '../../../../hooks/useGameRoster';
import { type PostAttemptData, type PutAttemptData } from '../../../../hooks/useShootoutAttempts';
import styles from '../GameDetailsPage.module.scss';

interface Props {
  /** null = closed; 'add' = add mode; any other string = edit mode (the attempt id) */
  mode: null | 'add' | string;
  /** Initial team side when adding (auto-determined by parent). */
  initialTeam: 'away' | 'home';
  /** Initial shooter id when editing. */
  initialShooterId: string;
  /** Initial scored state when editing. */
  initialScored: boolean;
  game: GameRecord;
  awayRoster: GameRosterEntry[];
  homeRoster: GameRosterEntry[];
  busy: boolean;
  onClose: () => void;
  onAdd: (payload: PostAttemptData) => Promise<unknown>;
  onUpdate: (id: string, payload: PutAttemptData) => Promise<unknown>;
}

const ShootoutAttemptModal = ({
  mode,
  initialTeam,
  initialShooterId,
  initialScored,
  game,
  awayRoster,
  homeRoster,
  busy,
  onClose,
  onAdd,
  onUpdate,
}: Props) => {
  const isEditMode = mode !== null && mode !== 'add';
  const [team, setTeam] = useState<'away' | 'home'>(initialTeam);
  const [shooterId, setShooterId] = useState(initialShooterId);
  const [scored, setScored] = useState(initialScored);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (mode !== null) {
      setTeam(initialTeam);
      setShooterId(initialShooterId);
      setScored(initialScored);
    }
  }, [mode, initialTeam, initialShooterId, initialScored]);

  const attemptRoster = (team === 'away' ? awayRoster : homeRoster).filter(
    (e) => e.position !== 'G',
  );
  const shooterOptions = attemptRoster.map((e) => ({
    value: e.player_id,
    label:
      e.jersey_number != null
        ? `#${e.jersey_number} ${e.first_name} ${e.last_name}`
        : `${e.first_name} ${e.last_name}`,
  }));
  const attemptTeamName = team === 'away' ? game.away_team_name : game.home_team_name;

  const teamOptions = (['away', 'home'] as const).map((side) => {
    const logo = side === 'away' ? game.away_team_logo : game.home_team_logo;
    const code = side === 'away' ? game.away_team_code : game.home_team_code;
    const primary = side === 'away' ? game.away_team_primary_color : game.home_team_primary_color;
    const text = side === 'away' ? game.away_team_text_color : game.home_team_text_color;
    return {
      value: side,
      label: (
        <>
          {logo ? (
            <img
              src={logo}
              alt={code}
              className={styles.teamSegmentLogo}
            />
          ) : (
            <span
              className={styles.teamSegmentLogoPlaceholder}
              style={{ background: primary, color: text }}
            >
              {code.slice(0, 1)}
            </span>
          )}
          {code}
        </>
      ),
    };
  });

  const resultOptions = [
    {
      value: 'miss',
      label: (
        <>
          <Icon
            name="cancel"
            size="1rem"
          />{' '}
          Miss
        </>
      ),
    },
    {
      value: 'goal',
      label: (
        <>
          <Icon
            name="check_circle"
            size="1rem"
          />{' '}
          Goal
        </>
      ),
    },
  ];

  const handleConfirm = async () => {
    const teamId = team === 'away' ? game.away_team_id : game.home_team_id;
    setSubmitting(true);
    try {
      if (isEditMode) {
        await onUpdate(mode as string, { team_id: teamId, shooter_id: shooterId, scored });
      } else {
        await onAdd({ team_id: teamId, shooter_id: shooterId, scored });
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={mode !== null}
      title={isEditMode ? 'Edit Attempt' : `Add Attempt — ${attemptTeamName}`}
      onClose={onClose}
      confirmLabel={submitting ? 'Saving…' : isEditMode ? 'Save Changes' : 'Record Attempt'}
      confirmDisabled={busy || submitting || !shooterId}
      busy={submitting}
      onConfirm={handleConfirm}
    >
      <div className={styles.goalForm}>
        {isEditMode && (
          <SegmentedControl
            value={team}
            onChange={(v) => {
              setTeam(v as 'away' | 'home');
              setShooterId('');
            }}
            options={teamOptions}
            disabled={submitting}
          />
        )}
        <div className={styles.goalFormField}>
          <label className={styles.goalFormLabel}>
            Shooter <span className={styles.required}>*</span>
          </label>
          <Select
            options={shooterOptions}
            value={shooterId}
            onChange={setShooterId}
            placeholder="Select shooter…"
            searchable
            disabled={submitting}
          />
        </div>
        <div className={styles.goalFormField}>
          <label className={styles.goalFormLabel}>Result</label>
          <SegmentedControl
            value={scored ? 'goal' : 'miss'}
            onChange={(v) => setScored(v === 'goal')}
            options={resultOptions}
            disabled={submitting}
          />
        </div>
      </div>
    </Modal>
  );
};

export default ShootoutAttemptModal;
