import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import Badge from '@/components/Badge/Badge';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import Field from '@/components/Field/Field';
import Icon from '@/components/Icon/Icon';
import Modal from '@/components/Modal/Modal';
import {
  type PlayoffSeriesRecord,
  type CreateSeriesData,
  type SeriesStatus,
  usePlayoffSeries,
} from '@/hooks/useGames';
import { type PlayoffFormatRule } from '@/hooks/useLeagues';
import { type SeasonGroupRecord, type SeasonTeam } from '@/hooks/useSeasonDetails';
import { type CreateSeasonData } from '@/hooks/useSeasons';
import styles from './SeasonPlayoffsTab.module.scss';

// ── Constants ──────────────────────────────────────────────────────────────────

const SCOPE_OPTIONS = [
  { value: 'league' as PlayoffFormatRule['scope'], label: 'Whole League' },
  { value: 'conference' as PlayoffFormatRule['scope'], label: 'Per Conference' },
  { value: 'division' as PlayoffFormatRule['scope'], label: 'Per Division' },
];
const METHOD_OPTIONS = [
  { value: 'top' as PlayoffFormatRule['method'], label: 'Top N (direct)' },
  { value: 'wildcard' as PlayoffFormatRule['method'], label: 'Wildcard (best remaining)' },
];
/**
 * Returns a round label based on the round's position within the total bracket.
 * Labels are always relative to the end: Final → Conference Finals → Second Round → First Round.
 */
const getRoundLabel = (round: number, totalRounds: number): string => {
  if (round === totalRounds) return 'Final';
  if (round === 1) return 'First Round';
  if (round === totalRounds - 1) return 'Conference Finals';
  if (round === totalRounds - 2) return 'Second Round';
  return `Round ${round}`;
};
const STATUS_INTENT: Record<SeriesStatus, 'neutral' | 'warning' | 'success'> = {
  upcoming: 'neutral',
  active: 'warning',
  complete: 'success',
};
const STATUS_LABEL: Record<SeriesStatus, string> = {
  upcoming: 'Upcoming',
  active: 'Active',
  complete: 'Complete',
};
const formatRuleText = (r: PlayoffFormatRule) => {
  const count = r.method === 'top' ? `Top ${r.count}` : `${r.count} wildcard`;
  const scope = { league: 'league-wide', conference: 'per conference', division: 'per division' }[
    r.scope
  ];
  return `${count} ${scope}`;
};

// ── Bracket structure derivation ──────────────────────────────────────────────

interface BracketRound {
  round: number;
  label: string;
  series: number;
}
interface BracketStructure {
  totalTeams: number;
  bracketSize: number;
  byes: number;
  rounds: BracketRound[];
}

const deriveBracketStructure = (
  rules: PlayoffFormatRule[] | null,
  groups: SeasonGroupRecord[],
): BracketStructure | null => {
  if (!rules || rules.length === 0) return null;

  const conferences = groups.filter((g) => g.role === 'conference').length;
  const divisions = groups.filter((g) => g.role === 'division').length;

  let totalTeams = 0;
  for (const rule of rules) {
    if (rule.scope === 'league') totalTeams += rule.count;
    else if (rule.scope === 'conference') totalTeams += rule.count * (conferences || 1);
    else if (rule.scope === 'division') totalTeams += rule.count * (divisions || 1);
  }

  if (totalTeams < 2) return null;

  const bracketSize = Math.pow(2, Math.ceil(Math.log2(totalTeams)));
  const numRounds = Math.log2(bracketSize);

  return {
    totalTeams,
    bracketSize,
    byes: bracketSize - totalTeams,
    rounds: Array.from({ length: numRounds }, (_, i) => ({
      round: i + 1,
      label: getRoundLabel(i + 1, numRounds),
      series: bracketSize / Math.pow(2, i + 1),
    })),
  };
};

// ── Series Form ────────────────────────────────────────────────────────────────

interface SeriesFormState {
  round: string;
  series_letter: string;
  home_team_id: string;
  away_team_id: string;
  games_to_win: string;
  status: SeriesStatus;
  home_wins: string;
  away_wins: string;
  winner_team_id: string;
}

const blankForm = (): SeriesFormState => ({
  round: '1',
  series_letter: '',
  home_team_id: '',
  away_team_id: '',
  games_to_win: '4',
  status: 'upcoming',
  home_wins: '0',
  away_wins: '0',
  winner_team_id: '',
});

interface SeriesModalProps {
  open: boolean;
  editTarget: PlayoffSeriesRecord | null;
  seasonId: string;
  teams: SeasonTeam[];
  busy: string | null;
  defaultRound?: number;
  bracketStructure?: BracketStructure | null;
  onCreate: (d: CreateSeriesData) => Promise<boolean>;
  onUpdate: (id: string, d: Partial<CreateSeriesData>) => Promise<boolean>;
  onClose: () => void;
}

const SeriesFormModal = ({
  open,
  editTarget,
  seasonId,
  teams,
  busy,
  defaultRound = 1,
  bracketStructure,
  onCreate,
  onUpdate,
  onClose,
}: SeriesModalProps) => {
  const [f, setF] = useState<SeriesFormState>(blankForm());
  useEffect(() => {
    if (!open) return;
    if (editTarget) {
      setF({
        round: String(editTarget.round),
        series_letter: editTarget.series_letter ?? '',
        home_team_id: editTarget.home_team_id,
        away_team_id: editTarget.away_team_id,
        games_to_win: String(editTarget.games_to_win),
        status: editTarget.status,
        home_wins: String(editTarget.home_wins),
        away_wins: String(editTarget.away_wins),
        winner_team_id: editTarget.winner_team_id ?? '',
      });
    } else {
      setF({ ...blankForm(), round: String(defaultRound) });
    }
  }, [open, editTarget, defaultRound]);

  const patch = (key: keyof SeriesFormState, val: string) =>
    setF((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    const payload: CreateSeriesData = {
      season_id: seasonId,
      round: parseInt(f.round, 10),
      series_letter: f.series_letter || null,
      home_team_id: f.home_team_id,
      away_team_id: f.away_team_id,
      games_to_win: parseInt(f.games_to_win, 10),
      status: f.status,
      home_wins: parseInt(f.home_wins, 10),
      away_wins: parseInt(f.away_wins, 10),
      winner_team_id: f.winner_team_id || null,
    };
    const ok = editTarget ? await onUpdate(editTarget.id, payload) : await onCreate(payload);
    if (ok) onClose();
  };

  const isBusy = busy === 'creating' || (editTarget != null && busy === editTarget.id);
  const canSave = !!f.home_team_id && !!f.away_team_id && f.home_team_id !== f.away_team_id;

  const teamOpts = teams.map((t) => (
    <option
      key={t.id}
      value={t.id}
    >
      {t.name}
    </option>
  ));

  return (
    <Modal
      open={open}
      title={editTarget ? 'Edit Playoff Series' : 'New Playoff Series'}
      onClose={onClose}
      confirmLabel={editTarget ? 'Save Changes' : 'Create Series'}
      confirmDisabled={!canSave}
      busy={isBusy}
      onConfirm={handleSave}
    >
      <div className={styles.formGrid}>
        <div className={styles.formRow}>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Round</label>
            <select
              className={styles.formSelect}
              value={f.round}
              onChange={(e) => patch('round', e.target.value)}
            >
              {(
                bracketStructure?.rounds ??
                [1, 2, 3, 4].map((r) => ({ round: r, label: getRoundLabel(r, 4) }))
              ).map(({ round: r, label }) => (
                <option
                  key={r}
                  value={r}
                >
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Series Letter (optional)</label>
            <input
              className={styles.formInput}
              value={f.series_letter}
              placeholder="e.g. A"
              maxLength={4}
              onChange={(e) => patch('series_letter', e.target.value)}
            />
          </div>
        </div>
        <div className={styles.formRow}>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Home Team</label>
            <select
              className={styles.formSelect}
              value={f.home_team_id}
              onChange={(e) => patch('home_team_id', e.target.value)}
            >
              <option value="">Select team…</option>
              {teamOpts}
            </select>
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Away Team</label>
            <select
              className={styles.formSelect}
              value={f.away_team_id}
              onChange={(e) => patch('away_team_id', e.target.value)}
            >
              <option value="">Select team…</option>
              {teamOpts}
            </select>
          </div>
        </div>
        <div className={styles.formRow}>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Format</label>
            <select
              className={styles.formSelect}
              value={f.games_to_win}
              onChange={(e) => patch('games_to_win', e.target.value)}
            >
              <option value="2">Best of 3</option>
              <option value="3">Best of 5</option>
              <option value="4">Best of 7</option>
            </select>
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Status</label>
            <select
              className={styles.formSelect}
              value={f.status}
              onChange={(e) => patch('status', e.target.value as SeriesStatus)}
            >
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="complete">Complete</option>
            </select>
          </div>
        </div>
        {editTarget && (
          <div className={styles.formRow}>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Home Wins</label>
              <input
                className={styles.formInput}
                type="number"
                min={0}
                max={f.games_to_win}
                value={f.home_wins}
                onChange={(e) => patch('home_wins', e.target.value)}
              />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Away Wins</label>
              <input
                className={styles.formInput}
                type="number"
                min={0}
                max={f.games_to_win}
                value={f.away_wins}
                onChange={(e) => patch('away_wins', e.target.value)}
              />
            </div>
          </div>
        )}
        {f.status === 'complete' && (
          <div className={styles.formField}>
            <label className={styles.formLabel}>Winner</label>
            <select
              className={styles.formSelect}
              value={f.winner_team_id}
              onChange={(e) => patch('winner_team_id', e.target.value)}
            >
              <option value="">Select winner…</option>
              {teamOpts}
            </select>
          </div>
        )}
      </div>
    </Modal>
  );
};

// ── Constants ──────────────────────────────────────────────────────────────────

const BEST_OF_PLAYOFF_OPTIONS = (leagueDefault: number) => [
  { value: '', label: `Use league default (Best of ${leagueDefault})` },
  { value: '3', label: 'Best of 3' },
  { value: '5', label: 'Best of 5' },
  { value: '7', label: 'Best of 7' },
];
const SHOOTOUT_OPTIONS = (leagueDefault: number) => [
  { value: '', label: `Use league default (${leagueDefault} rounds)` },
  { value: '3', label: '3 rounds' },
  { value: '5', label: '5 rounds' },
  { value: '7', label: '7 rounds' },
];
const SCORING_OPTIONS = (leagueDefault: string) => [
  { value: '', label: `Use league default (${leagueDefault})` },
  { value: '2-1-0', label: '2-1-0  (W / OTL / L)' },
  { value: '3-2-1-0', label: '3-2-1-0  (W / OT W / OTL / L)' },
];

// ── Game Settings Modal ────────────────────────────────────────────────────────

interface GameSettingsFormValues {
  best_of_playoff: string;
  best_of_shootout: string;
  scoring_system: string;
}

interface GameSettingsModalProps {
  open: boolean;
  bestOfPlayoff: number | null;
  bestOfShootout: number | null;
  scoringSystem: string | null;
  leagueBestOfPlayoff: number;
  leagueBestOfShootout: number;
  leagueScoringSystem: string;
  seasonId: string;
  updateSeason: (id: string, payload: Partial<CreateSeasonData>) => Promise<boolean>;
  onClose: () => void;
}

const GameSettingsModal = ({
  open,
  bestOfPlayoff,
  bestOfShootout,
  scoringSystem,
  leagueBestOfPlayoff,
  leagueBestOfShootout,
  leagueScoringSystem,
  seasonId,
  updateSeason,
  onClose,
}: GameSettingsModalProps) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<GameSettingsFormValues>({
    defaultValues: { best_of_playoff: '', best_of_shootout: '', scoring_system: '' },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      best_of_playoff: bestOfPlayoff != null ? String(bestOfPlayoff) : '',
      best_of_shootout: bestOfShootout != null ? String(bestOfShootout) : '',
      scoring_system: scoringSystem ?? '',
    });
  }, [open, bestOfPlayoff, bestOfShootout, scoringSystem, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const ok = await updateSeason(seasonId, {
      best_of_playoff: data.best_of_playoff ? parseInt(data.best_of_playoff, 10) : null,
      best_of_shootout: data.best_of_shootout ? parseInt(data.best_of_shootout, 10) : null,
      scoring_system: (data.scoring_system as '2-1-0' | '3-2-1-0') || null,
    });
    if (ok) onClose();
  });

  return (
    <Modal
      open={open}
      title="Game Settings"
      onClose={onClose}
      confirmLabel={isSubmitting ? 'Saving…' : 'Save Changes'}
      confirmForm="game-settings-form"
      confirmDisabled={isSubmitting}
      busy={isSubmitting}
    >
      <form
        id="game-settings-form"
        className={styles.modalForm}
        onSubmit={onSubmit}
      >
        <Field
          type="select"
          label="Playoff Series Format"
          control={control}
          name="best_of_playoff"
          options={BEST_OF_PLAYOFF_OPTIONS(leagueBestOfPlayoff)}
          disabled={isSubmitting}
        />
        <Field
          type="select"
          label="Shootout Rounds"
          control={control}
          name="best_of_shootout"
          options={SHOOTOUT_OPTIONS(leagueBestOfShootout)}
          disabled={isSubmitting}
        />
        <Field
          type="select"
          label="Scoring System"
          control={control}
          name="scoring_system"
          options={SCORING_OPTIONS(leagueScoringSystem)}
          disabled={isSubmitting}
        />
      </form>
    </Modal>
  );
};

// ── Playoff Format Modal ──────────────────────────────────────────────────────

interface PlayoffFormatFormValues {
  rules: PlayoffFormatRule[];
}

interface PlayoffFormatModalProps {
  open: boolean;
  playoffFormat: PlayoffFormatRule[] | null;
  seasonId: string;
  updateSeason: (id: string, payload: Partial<CreateSeasonData>) => Promise<boolean>;
  onClose: () => void;
}

const EMPTY_RULE: PlayoffFormatRule = { scope: 'league', method: 'top', count: 4 };

const PlayoffFormatModal = ({
  open,
  playoffFormat,
  seasonId,
  updateSeason,
  onClose,
}: PlayoffFormatModalProps) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<PlayoffFormatFormValues>({
    defaultValues: { rules: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'rules' });

  useEffect(() => {
    if (!open) return;
    reset({ rules: playoffFormat ?? [] });
  }, [open, playoffFormat, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const rules = data.rules.map((r) => ({ ...r, count: Number(r.count) }));
    const ok = await updateSeason(seasonId, {
      playoff_format: rules.length > 0 ? rules : null,
    });
    if (ok) onClose();
  });

  return (
    <Modal
      open={open}
      title="Playoff Qualification Format"
      size="lg"
      onClose={onClose}
      confirmLabel={isSubmitting ? 'Saving…' : 'Save Rules'}
      confirmForm="playoff-format-form"
      confirmDisabled={isSubmitting}
      busy={isSubmitting}
    >
      <form
        id="playoff-format-form"
        onSubmit={onSubmit}
      >
        {fields.length > 0 && (
          <div className={styles.formatHeaderRow}>
            <span className={styles.formatHeaderCell}>Scope</span>
            <span className={styles.formatHeaderCell}>Method</span>
            <span className={styles.formatHeaderCell}>Count</span>
            <span />
          </div>
        )}

        <div className={styles.formatRuleRows}>
          {fields.map((field, i) => (
            <div
              key={field.id}
              className={styles.formatRuleRow}
            >
              <Field
                type="select"
                control={control}
                name={`rules.${i}.scope`}
                options={SCOPE_OPTIONS}
                disabled={isSubmitting}
              />
              <Field
                type="select"
                control={control}
                name={`rules.${i}.method`}
                options={METHOD_OPTIONS}
                disabled={isSubmitting}
              />
              <Field
                type="number"
                control={control}
                name={`rules.${i}.count`}
                min={1}
                max={32}
                disabled={isSubmitting}
              />
              <button
                type="button"
                className={styles.formatDeleteBtn}
                onClick={() => remove(i)}
                disabled={isSubmitting}
                aria-label="Remove rule"
              >
                <Icon
                  name="delete"
                  size="1em"
                />
              </button>
            </div>
          ))}
        </div>

        <div className={styles.formatAddRow}>
          <Button
            type="button"
            variant="ghost"
            intent="neutral"
            icon="add"
            size="sm"
            disabled={isSubmitting}
            onClick={() => append({ ...EMPTY_RULE })}
          >
            Add Rule
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ── Bracket Slot ──────────────────────────────────────────────────────────────

interface BracketSlotProps {
  series: PlayoffSeriesRecord | null;
  isEnded: boolean;
  busy: string | null;
  onAdd: () => void;
  onEdit: (s: PlayoffSeriesRecord) => void;
  onDelete: (s: PlayoffSeriesRecord) => void;
}

const BracketSlot = ({ series, isEnded, busy, onAdd, onEdit, onDelete }: BracketSlotProps) => {
  if (!series) {
    return (
      <div
        className={[
          styles.bracketSlot,
          styles.slotFilled,
          styles.slotEmptyMatchup,
          isEnded ? styles.slotEmptyDisabled : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role={!isEnded ? 'button' : undefined}
        tabIndex={!isEnded ? 0 : undefined}
        onClick={!isEnded ? onAdd : undefined}
        onKeyDown={!isEnded ? (e) => e.key === 'Enter' && onAdd() : undefined}
      >
        <div className={`${styles.slotTeam} ${styles.slotTeamTbd}`}>
          <span className={styles.slotTeamName}>TBD</span>
        </div>
        <div className={styles.slotDivider} />
        <div className={`${styles.slotTeam} ${styles.slotTeamTbd}`}>
          <span className={styles.slotTeamName}>TBD</span>
        </div>
      </div>
    );
  }

  const homeWon = series.winner_team_id === series.home_team_id;
  const awayWon = series.winner_team_id === series.away_team_id;
  const isComplete = series.status === 'complete';

  return (
    <div className={`${styles.bracketSlot} ${styles.slotFilled}`}>
      <div
        className={[
          styles.slotTeam,
          awayWon ? styles.slotTeamWinner : '',
          isComplete && !awayWon ? styles.slotTeamLoser : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className={styles.slotTeamName}>{series.away_team_name}</span>
        <span className={styles.slotTeamWins}>{series.away_wins}</span>
      </div>
      <div className={styles.slotDivider} />
      <div
        className={[
          styles.slotTeam,
          homeWon ? styles.slotTeamWinner : '',
          isComplete && !homeWon ? styles.slotTeamLoser : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className={styles.slotTeamName}>{series.home_team_name}</span>
        <span className={styles.slotTeamWins}>{series.home_wins}</span>
      </div>
      <div className={styles.slotFooter}>
        <Badge
          label={STATUS_LABEL[series.status]}
          intent={STATUS_INTENT[series.status]}
        />
        <div className={styles.slotActions}>
          <Button
            variant="ghost"
            intent="neutral"
            icon="edit"
            size="sm"
            tooltip="Edit series"
            disabled={isEnded}
            onClick={() => onEdit(series)}
          />
          <Button
            variant="ghost"
            intent="danger"
            icon="delete"
            size="sm"
            tooltip="Delete series"
            disabled={isEnded || busy === series.id}
            onClick={() => onDelete(series)}
          />
        </div>
      </div>
    </div>
  );
};

// ── Main Tab Component ────────────────────────────────────────────────────────

interface Props {
  seasonId: string;
  seasonTeams: SeasonTeam[];
  groups: SeasonGroupRecord[];
  isEnded: boolean;
  playoffFormat: PlayoffFormatRule[] | null;
  bestOfPlayoff: number | null;
  bestOfShootout: number | null;
  scoringSystem: '2-1-0' | '3-2-1-0' | null;
  leagueBestOfPlayoff: number;
  leagueBestOfShootout: number;
  leagueScoringSystem: string;
  updateSeason: (id: string, payload: Partial<CreateSeasonData>) => Promise<boolean>;
}

const SeasonPlayoffsTab = ({
  seasonId,
  seasonTeams,
  groups,
  isEnded,
  playoffFormat,
  bestOfPlayoff,
  bestOfShootout,
  scoringSystem,
  leagueBestOfPlayoff,
  leagueBestOfShootout,
  leagueScoringSystem,
  updateSeason,
}: Props) => {
  const {
    series,
    loading: seriesLoading,
    busy: seriesBusy,
    createSeries,
    updateSeries,
    deleteSeries,
  } = usePlayoffSeries(seasonId);

  // ── Derived bracket structure ─────────────────────────────────────────────────
  const bracketStructure = useMemo(
    () => deriveBracketStructure(playoffFormat, groups),
    [playoffFormat, groups],
  );

  // ── Modal state ───────────────────────────────────────────────────────────────
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [formatModalOpen, setFormatModalOpen] = useState(false);

  // ── Series state ─────────────────────────────────────────────────────────────
  const [seriesModalOpen, setSeriesModalOpen] = useState(false);
  const [editTargetSeries, setEditTargetSeries] = useState<PlayoffSeriesRecord | null>(null);
  const [confirmDeleteSeries, setConfirmDeleteSeries] = useState<PlayoffSeriesRecord | null>(null);
  const [createRound, setCreateRound] = useState(1);
  const openCreateSeries = (round = 1) => {
    setEditTargetSeries(null);
    setCreateRound(round);
    setSeriesModalOpen(true);
  };
  const openEditSeries = (s: PlayoffSeriesRecord) => {
    setEditTargetSeries(s);
    setSeriesModalOpen(true);
  };

  const seriesByRound = series.reduce<Record<number, PlayoffSeriesRecord[]>>((acc, s) => {
    if (!acc[s.round]) acc[s.round] = [];
    acc[s.round].push(s);
    return acc;
  }, {});

  return (
    <>
      <div className={styles.layout}>
        {/* ── Left column — Playoff Bracket ── */}
        <div className={styles.layoutLeft}>
          {/* ── Playoff Series ── */}
          <Card
            title="Playoff Bracket"
            action={
              !bracketStructure ? (
                <Button
                  variant="filled"
                  intent="accent"
                  icon="add"
                  size="sm"
                  disabled={isEnded}
                  onClick={() => openCreateSeries()}
                >
                  Add Series
                </Button>
              ) : undefined
            }
          >
            {seriesLoading ? (
              <p className={styles.emptyState}>Loading…</p>
            ) : bracketStructure ? (
              <div className={styles.bracketGrid}>
                {bracketStructure.rounds.map((roundInfo) => {
                  const roundSeries = seriesByRound[roundInfo.round] ?? [];
                  return (
                    <div
                      key={roundInfo.round}
                      className={styles.bracketRound}
                    >
                      <p className={styles.bracketRoundLabel}>{roundInfo.label}</p>
                      <div className={styles.bracketSlots}>
                        {Array.from({ length: roundInfo.series }, (_, slotIndex) => (
                          <BracketSlot
                            key={slotIndex}
                            series={roundSeries[slotIndex] ?? null}
                            isEnded={isEnded}
                            busy={seriesBusy}
                            onAdd={() => openCreateSeries(roundInfo.round)}
                            onEdit={openEditSeries}
                            onDelete={setConfirmDeleteSeries}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : series.length === 0 ? (
              <p className={styles.emptyState}>
                No playoff series yet. Configure a playoff format or add a series manually.
              </p>
            ) : (
              <div className={styles.seriesStack}>
                {Object.keys(seriesByRound)
                  .map(Number)
                  .sort()
                  .map((round) => {
                    const maxRound = Math.max(...Object.keys(seriesByRound).map(Number));
                    return (
                      <div key={round}>
                        <p className={styles.roundLabel}>{getRoundLabel(round, maxRound)}</p>
                        {seriesByRound[round].map((s) => (
                          <div
                            key={s.id}
                            className={styles.seriesRow}
                          >
                            <span className={styles.seriesTeams}>
                              {s.away_team_name} @ {s.home_team_name}
                              {s.series_letter && <> &nbsp;({s.series_letter})</>}
                            </span>
                            <span className={styles.seriesScore}>
                              {s.away_wins}–{s.home_wins}
                            </span>
                            <Badge
                              label={STATUS_LABEL[s.status]}
                              intent={STATUS_INTENT[s.status]}
                            />
                            <div className={styles.seriesRowActions}>
                              <Button
                                variant="ghost"
                                intent="neutral"
                                icon="edit"
                                size="sm"
                                tooltip="Edit series"
                                disabled={isEnded}
                                onClick={() => openEditSeries(s)}
                              />
                              <Button
                                variant="ghost"
                                intent="danger"
                                icon="delete"
                                size="sm"
                                tooltip="Delete series"
                                disabled={isEnded || seriesBusy === s.id}
                                onClick={() => setConfirmDeleteSeries(s)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
              </div>
            )}
          </Card>
        </div>

        {/* ── Right column — Settings + Qualification ── */}
        <div className={styles.layoutRight}>
          {/* ── Game Settings ── */}
          <Card
            title="Game Settings"
            action={
              <Button
                variant="outlined"
                intent="neutral"
                icon="edit"
                size="sm"
                tooltip="Edit game settings"
                disabled={isEnded}
                onClick={() => setSettingsModalOpen(true)}
              />
            }
          >
            <div className={styles.settingsGrid}>
              <div className={styles.settingsItem}>
                <span className={styles.settingsLabel}>Playoff Series Format</span>
                <span className={styles.settingsValue}>
                  {bestOfPlayoff != null
                    ? `Best of ${bestOfPlayoff}`
                    : `Best of ${leagueBestOfPlayoff} (league default)`}
                </span>
              </div>
              <div className={styles.settingsItem}>
                <span className={styles.settingsLabel}>Shootout Rounds</span>
                <span className={styles.settingsValue}>
                  {bestOfShootout != null
                    ? `${bestOfShootout} rounds`
                    : `${leagueBestOfShootout} rounds (league default)`}
                </span>
              </div>
              <div className={styles.settingsItem}>
                <span className={styles.settingsLabel}>Scoring System</span>
                <span className={styles.settingsValue}>
                  {scoringSystem ?? `${leagueScoringSystem} (league default)`}
                </span>
              </div>
            </div>
          </Card>

          {/* ── Playoff Qualification Format ── */}
          <Card
            title="Playoff Qualification Format"
            action={
              <Button
                variant="outlined"
                intent="neutral"
                icon="edit"
                size="sm"
                tooltip="Edit qualification format"
                disabled={isEnded}
                onClick={() => setFormatModalOpen(true)}
              />
            }
          >
            {playoffFormat && playoffFormat.length > 0 ? (
              <ol className={styles.formatRuleList}>
                {playoffFormat.map((r, i) => (
                  <li
                    key={i}
                    className={styles.formatRuleDisplay}
                  >
                    {formatRuleText(r)}
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.formatEmpty}>
                No rules configured — qualification is managed manually.
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* ── Modals ── */}
      <>
        <PlayoffFormatModal
          open={formatModalOpen}
          playoffFormat={playoffFormat}
          seasonId={seasonId}
          updateSeason={updateSeason}
          onClose={() => setFormatModalOpen(false)}
        />

        <GameSettingsModal
          open={settingsModalOpen}
          bestOfPlayoff={bestOfPlayoff}
          bestOfShootout={bestOfShootout}
          scoringSystem={scoringSystem}
          leagueBestOfPlayoff={leagueBestOfPlayoff}
          leagueBestOfShootout={leagueBestOfShootout}
          leagueScoringSystem={leagueScoringSystem}
          seasonId={seasonId}
          updateSeason={updateSeason}
          onClose={() => setSettingsModalOpen(false)}
        />

        <SeriesFormModal
          open={seriesModalOpen}
          editTarget={editTargetSeries}
          seasonId={seasonId}
          teams={seasonTeams}
          busy={seriesBusy}
          defaultRound={createRound}
          bracketStructure={bracketStructure}
          onCreate={createSeries}
          onUpdate={updateSeries}
          onClose={() => setSeriesModalOpen(false)}
        />

        <ConfirmModal
          open={!!confirmDeleteSeries}
          title="Delete Playoff Series"
          body={
            <>
              Delete the series between <strong>{confirmDeleteSeries?.home_team_name}</strong> and{' '}
              <strong>{confirmDeleteSeries?.away_team_name}</strong>? This cannot be undone.
            </>
          }
          confirmLabel="Delete"
          confirmIcon="delete"
          variant="danger"
          busy={seriesBusy === confirmDeleteSeries?.id}
          onCancel={() => setConfirmDeleteSeries(null)}
          onConfirm={async () => {
            if (!confirmDeleteSeries) return;
            await deleteSeries(confirmDeleteSeries.id);
            setConfirmDeleteSeries(null);
          }}
        />
      </>
    </>
  );
};

export default SeasonPlayoffsTab;
