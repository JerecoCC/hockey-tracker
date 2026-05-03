import { useEffect, useState } from 'react';
import Badge from '@/components/Badge/Badge';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import Icon from '@/components/Icon/Icon';
import Modal from '@/components/Modal/Modal';
import {
  type PlayoffSeriesRecord,
  type CreateSeriesData,
  type SeriesStatus,
  usePlayoffSeries,
} from '@/hooks/useGames';
import { type PlayoffFormatRule } from '@/hooks/useLeagues';
import { type SeasonTeam } from '@/hooks/useSeasonDetails';
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
const ROUND_LABELS: Record<number, string> = {
  1: 'Round 1',
  2: 'Second Round',
  3: 'Conference Finals',
  4: 'Final',
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
      setF(blankForm());
    }
  }, [open, editTarget]);

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
              {[1, 2, 3, 4].map((r) => (
                <option
                  key={r}
                  value={r}
                >
                  {ROUND_LABELS[r] ?? `Round ${r}`}
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

const BEST_OF_OPTIONS = [
  { value: '3', label: 'Best of 3' },
  { value: '5', label: 'Best of 5' },
  { value: '7', label: 'Best of 7' },
];
const SHOOTOUT_OPTIONS = [
  { value: '3', label: '3 rounds' },
  { value: '5', label: '5 rounds' },
  { value: '7', label: '7 rounds' },
];
const SCORING_OPTIONS = [
  { value: '2-1-0', label: '2-1-0  (W / OTL / L)' },
  { value: '3-2-1-0', label: '3-2-1-0  (W / OT W / OTL / L)' },
];

// ── Main Tab Component ────────────────────────────────────────────────────────

interface Props {
  seasonId: string;
  seasonTeams: SeasonTeam[];
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

  // ── Format state ─────────────────────────────────────────────────────────────
  const [editingFormat, setEditingFormat] = useState(false);
  const [formatRules, setFormatRules] = useState<PlayoffFormatRule[]>([]);
  const [savingFormat, setSavingFormat] = useState(false);

  const startEditFormat = () => {
    setFormatRules(playoffFormat ?? []);
    setEditingFormat(true);
  };
  const cancelEditFormat = () => setEditingFormat(false);
  const saveFormat = async () => {
    setSavingFormat(true);
    const ok = await updateSeason(seasonId, {
      playoff_format: formatRules.length > 0 ? formatRules : null,
    });
    if (ok) setEditingFormat(false);
    setSavingFormat(false);
  };
  const addRule = () => setFormatRules((p) => [...p, { scope: 'league', method: 'top', count: 4 }]);
  const updateRule = (i: number, patch: Partial<PlayoffFormatRule>) =>
    setFormatRules((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRule = (i: number) => setFormatRules((p) => p.filter((_, idx) => idx !== i));

  // ── Game settings state ───────────────────────────────────────────────────────
  const [editingSettings, setEditingSettings] = useState(false);
  const [settingsBestOfPlayoff, setSettingsBestOfPlayoff] = useState<string>('');
  const [settingsBestOfShootout, setSettingsBestOfShootout] = useState<string>('');
  const [settingsScoringSystem, setSettingsScoringSystem] = useState<string>('');
  const [savingSettings, setSavingSettings] = useState(false);

  const startEditSettings = () => {
    setSettingsBestOfPlayoff(bestOfPlayoff != null ? String(bestOfPlayoff) : '');
    setSettingsBestOfShootout(bestOfShootout != null ? String(bestOfShootout) : '');
    setSettingsScoringSystem(scoringSystem ?? '');
    setEditingSettings(true);
  };
  const cancelEditSettings = () => setEditingSettings(false);
  const saveSettings = async () => {
    setSavingSettings(true);
    const ok = await updateSeason(seasonId, {
      best_of_playoff: settingsBestOfPlayoff ? parseInt(settingsBestOfPlayoff, 10) : null,
      best_of_shootout: settingsBestOfShootout ? parseInt(settingsBestOfShootout, 10) : null,
      scoring_system: (settingsScoringSystem as '2-1-0' | '3-2-1-0') || null,
    });
    if (ok) setEditingSettings(false);
    setSavingSettings(false);
  };

  // ── Series state ─────────────────────────────────────────────────────────────
  const [seriesModalOpen, setSeriesModalOpen] = useState(false);
  const [editTargetSeries, setEditTargetSeries] = useState<PlayoffSeriesRecord | null>(null);
  const [confirmDeleteSeries, setConfirmDeleteSeries] = useState<PlayoffSeriesRecord | null>(null);
  const openCreateSeries = () => {
    setEditTargetSeries(null);
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
    <div className={styles.playoffsStack}>
      {/* ── Game Settings ── */}
      <Card
        title="Game Settings"
        action={
          !editingSettings ? (
            <Button
              variant="outlined"
              intent="neutral"
              icon="edit"
              size="sm"
              disabled={isEnded}
              onClick={startEditSettings}
            >
              Edit
            </Button>
          ) : (
            <div className={styles.formatActions}>
              <Button
                variant="outlined"
                intent="neutral"
                size="sm"
                onClick={cancelEditSettings}
                disabled={savingSettings}
              >
                Cancel
              </Button>
              <Button
                variant="filled"
                intent="accent"
                size="sm"
                icon="save"
                onClick={saveSettings}
                disabled={savingSettings}
              >
                {savingSettings ? 'Saving…' : 'Save'}
              </Button>
            </div>
          )
        }
      >
        {!editingSettings ? (
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
        ) : (
          <div className={styles.settingsEditGrid}>
            <div className={styles.settingsEditField}>
              <label className={styles.settingsLabel}>
                Playoff Series Format
                <span className={styles.settingsHint}>
                  {' '}
                  (league default: Best of {leagueBestOfPlayoff})
                </span>
              </label>
              <select
                className={styles.settingsSelect}
                value={settingsBestOfPlayoff}
                onChange={(e) => setSettingsBestOfPlayoff(e.target.value)}
                disabled={savingSettings}
              >
                <option value="">Use league default</option>
                {BEST_OF_OPTIONS.map((o) => (
                  <option
                    key={o.value}
                    value={o.value}
                  >
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.settingsEditField}>
              <label className={styles.settingsLabel}>
                Shootout Rounds
                <span className={styles.settingsHint}>
                  {' '}
                  (league default: {leagueBestOfShootout})
                </span>
              </label>
              <select
                className={styles.settingsSelect}
                value={settingsBestOfShootout}
                onChange={(e) => setSettingsBestOfShootout(e.target.value)}
                disabled={savingSettings}
              >
                <option value="">Use league default</option>
                {SHOOTOUT_OPTIONS.map((o) => (
                  <option
                    key={o.value}
                    value={o.value}
                  >
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.settingsEditField}>
              <label className={styles.settingsLabel}>
                Scoring System
                <span className={styles.settingsHint}>
                  {' '}
                  (league default: {leagueScoringSystem})
                </span>
              </label>
              <select
                className={styles.settingsSelect}
                value={settingsScoringSystem}
                onChange={(e) => setSettingsScoringSystem(e.target.value)}
                disabled={savingSettings}
              >
                <option value="">Use league default</option>
                {SCORING_OPTIONS.map((o) => (
                  <option
                    key={o.value}
                    value={o.value}
                  >
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </Card>

      {/* ── Playoff Qualification Format ── */}
      <Card
        title="Playoff Qualification Format"
        action={
          !editingFormat ? (
            <Button
              variant="outlined"
              intent="neutral"
              icon="edit"
              size="sm"
              disabled={isEnded}
              onClick={startEditFormat}
            >
              Edit
            </Button>
          ) : (
            <div className={styles.formatActions}>
              <Button
                variant="outlined"
                intent="neutral"
                size="sm"
                onClick={cancelEditFormat}
                disabled={savingFormat}
              >
                Cancel
              </Button>
              <Button
                variant="filled"
                intent="accent"
                size="sm"
                icon="save"
                onClick={saveFormat}
                disabled={savingFormat}
              >
                {savingFormat ? 'Saving…' : 'Save'}
              </Button>
            </div>
          )
        }
      >
        {!editingFormat ? (
          playoffFormat && playoffFormat.length > 0 ? (
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
          )
        ) : (
          <div className={styles.formatEditorStack}>
            {formatRules.map((rule, i) => (
              <div
                key={i}
                className={styles.formatRule}
              >
                <select
                  className={styles.formatRuleSelect}
                  value={rule.scope}
                  onChange={(e) =>
                    updateRule(i, { scope: e.target.value as PlayoffFormatRule['scope'] })
                  }
                >
                  {SCOPE_OPTIONS.map((o) => (
                    <option
                      key={o.value}
                      value={o.value}
                    >
                      {o.label}
                    </option>
                  ))}
                </select>
                <select
                  className={styles.formatRuleSelect}
                  value={rule.method}
                  onChange={(e) =>
                    updateRule(i, { method: e.target.value as PlayoffFormatRule['method'] })
                  }
                >
                  {METHOD_OPTIONS.map((o) => (
                    <option
                      key={o.value}
                      value={o.value}
                    >
                      {o.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className={styles.formatRuleCount}
                  value={rule.count}
                  min={1}
                  max={32}
                  onChange={(e) =>
                    updateRule(i, { count: Math.max(1, parseInt(e.target.value, 10) || 1) })
                  }
                />
                <button
                  type="button"
                  className={styles.formatRuleRemove}
                  onClick={() => removeRule(i)}
                  aria-label="Remove rule"
                >
                  <Icon
                    name="close"
                    size="0.85em"
                  />
                </button>
              </div>
            ))}
            <div>
              <button
                type="button"
                className={styles.formatRuleRemove}
                style={{ width: 'auto', padding: '4px 10px', gap: '4px' }}
                onClick={addRule}
              >
                <Icon
                  name="add"
                  size="0.85em"
                />{' '}
                Add Rule
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* ── Playoff Series ── */}
      <Card
        title="Playoff Bracket"
        action={
          <Button
            variant="filled"
            intent="accent"
            icon="add"
            size="sm"
            disabled={isEnded}
            onClick={openCreateSeries}
          >
            Add Series
          </Button>
        }
      >
        {seriesLoading ? (
          <p className={styles.emptyState}>Loading…</p>
        ) : series.length === 0 ? (
          <p className={styles.emptyState}>No playoff series yet. Add one to build the bracket.</p>
        ) : (
          <div className={styles.seriesStack}>
            {Object.keys(seriesByRound)
              .map(Number)
              .sort()
              .map((round) => (
                <div key={round}>
                  <p className={styles.roundLabel}>{ROUND_LABELS[round] ?? `Round ${round}`}</p>
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
              ))}
          </div>
        )}
      </Card>

      <SeriesFormModal
        open={seriesModalOpen}
        editTarget={editTargetSeries}
        seasonId={seasonId}
        teams={seasonTeams}
        busy={seriesBusy}
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
    </div>
  );
};

export default SeasonPlayoffsTab;
