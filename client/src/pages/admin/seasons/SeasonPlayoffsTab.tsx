import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import Badge from '@/components/Badge/Badge';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ConfirmModal from '@/components/ConfirmModal/ConfirmModal';
import Field from '@/components/Field/Field';
import Icon from '@/components/Icon/Icon';
import Modal from '@/components/Modal/Modal';
import { type PlayoffSeriesRecord, type SeriesStatus, usePlayoffSeries } from '@/hooks/useGames';
import { type PlayoffFormatRule } from '@/hooks/useLeagues';
import { type SeasonGroupRecord, type SeasonTeam } from '@/hooks/useSeasonDetails';
import { type CreateSeasonData } from '@/hooks/useSeasons';
import Select from '@/components/Select/Select';
import useBracketRuleSets from '@/hooks/useBracketRuleSets';
import useSeasonStandings from '@/hooks/useSeasonStandings';
import BracketRulesModal, {
  type BracketStructure,
  deriveBracketStructureFromSize,
  getRoundLabel,
  makeSlotKey,
} from './BracketRulesModal';
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

  return deriveBracketStructureFromSize(totalTeams);
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
  busy: string | null;
  /** Simulated team name for slot 1 (away). Only shown when series is null. */
  simulatedAway?: string | null;
  /** Simulated team name for slot 2 (home). Only shown when series is null. */
  simulatedHome?: string | null;
  onDelete: (s: PlayoffSeriesRecord) => void;
}

const BracketSlot = ({
  series,
  busy,
  simulatedAway,
  simulatedHome,
  onDelete,
}: BracketSlotProps) => {
  if (!series) {
    const isSimulated = simulatedAway != null || simulatedHome != null;
    return (
      <div
        className={[
          styles.bracketSlot,
          styles.slotFilled,
          isSimulated ? styles.slotSimulated : styles.slotEmptyMatchup,
          styles.slotEmptyDisabled,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className={`${styles.slotTeam} ${!simulatedAway ? styles.slotTeamTbd : ''}`}>
          <span className={styles.slotTeamName}>{simulatedAway ?? 'TBD'}</span>
        </div>
        <div className={styles.slotDivider} />
        <div className={`${styles.slotTeam} ${!simulatedHome ? styles.slotTeamTbd : ''}`}>
          <span className={styles.slotTeamName}>{simulatedHome ?? 'TBD'}</span>
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
            intent="danger"
            icon="delete"
            size="sm"
            tooltip="Delete series"
            disabled={busy === series.id}
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
  leagueId: string;
  bracketRuleSetId: string | null;
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
  leagueId,
  bracketRuleSetId,
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

  const { ruleSets, fetchRuleSet } = useBracketRuleSets(leagueId);
  const ruleSetOptions = ruleSets.map((rs) => ({ value: rs.id, label: rs.name }));

  const { standings } = useSeasonStandings(seasonId);

  // ── Simulation state ──────────────────────────────────────────────────────────
  const [simulatedSlots, setSimulatedSlots] = useState<Record<string, string | null> | null>(null);
  const [simulating, setSimulating] = useState(false);

  const handleSimulate = async () => {
    if (!bracketRuleSetId) return;
    setSimulating(true);
    try {
      const ruleSet = await fetchRuleSet(bracketRuleSetId);
      if (!ruleSet) return;

      // Recursively collect all team IDs belonging to a group and its children.
      const getGroupTeamIds = (groupId: string): Set<string> => {
        const ids = new Set<string>();
        const collect = (gid: string) => {
          const g = groups.find((gr) => gr.id === gid);
          if (!g) return;
          g.teams.forEach((t) => ids.add(t.id));
          groups.filter((gr) => gr.parent_id === gid).forEach((child) => collect(child.id));
        };
        collect(groupId);
        return ids;
      };

      const result: Record<string, string | null> = {};
      for (const slot of ruleSet.slots) {
        if (slot.rule_type !== 'seed') {
          result[slot.slot_key] = null;
          continue;
        }
        let filtered = standings;
        if (
          (slot.scope === 'specific_conference' || slot.scope === 'specific_division') &&
          slot.group_id
        ) {
          const ids = getGroupTeamIds(slot.group_id);
          filtered = standings.filter((s) => ids.has(s.team_id));
        }
        const idx = (slot.rank ?? 1) - 1;
        result[slot.slot_key] = filtered[idx]?.team_name ?? null;
      }
      setSimulatedSlots(result);
    } finally {
      setSimulating(false);
    }
  };

  // ── Derived bracket structure ─────────────────────────────────────────────────
  const bracketStructure = useMemo(
    () => deriveBracketStructure(playoffFormat, groups),
    [playoffFormat, groups],
  );

  // ── Modal state ───────────────────────────────────────────────────────────────
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [formatModalOpen, setFormatModalOpen] = useState(false);
  const [bracketRulesModalOpen, setBracketRulesModalOpen] = useState(false);

  // ── Series state ─────────────────────────────────────────────────────────────
  const [confirmDeleteSeries, setConfirmDeleteSeries] = useState<PlayoffSeriesRecord | null>(null);

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
              bracketStructure && bracketRuleSetId ? (
                simulatedSlots !== null ? (
                  <Button
                    variant="outlined"
                    intent="neutral"
                    icon="close"
                    size="sm"
                    onClick={() => setSimulatedSlots(null)}
                  >
                    Clear
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    intent="accent"
                    icon="play_arrow"
                    size="sm"
                    disabled={simulating}
                    onClick={handleSimulate}
                  >
                    Simulate
                  </Button>
                )
              ) : null
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
                            busy={seriesBusy}
                            simulatedAway={
                              simulatedSlots?.[makeSlotKey(roundInfo.round, slotIndex, 'away')]
                            }
                            simulatedHome={
                              simulatedSlots?.[makeSlotKey(roundInfo.round, slotIndex, 'home')]
                            }
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
                                intent="danger"
                                icon="delete"
                                size="sm"
                                tooltip="Delete series"
                                disabled={seriesBusy === s.id}
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
          {/* ── Bracket Rule Set ── */}
          <Card
            title="Bracket Rule Set"
            action={
              bracketRuleSetId ? (
                <Button
                  variant="outlined"
                  intent="neutral"
                  icon="edit"
                  size="sm"
                  tooltip="Edit bracket rules"
                  disabled={isEnded}
                  onClick={() => setBracketRulesModalOpen(true)}
                />
              ) : null
            }
          >
            <div className={styles.ruleSetSelector}>
              <Select
                value={bracketRuleSetId}
                options={ruleSetOptions}
                placeholder={
                  ruleSetOptions.length === 0
                    ? 'No rule sets — create one in the league Playoffs tab'
                    : 'Select a rule set…'
                }
                onChange={async (id) => {
                  await updateSeason(seasonId, { bracket_rule_set_id: id });
                }}
                disabled={isEnded || ruleSetOptions.length === 0}
              />
              {!bracketRuleSetId && ruleSetOptions.length > 0 && (
                <p className={styles.ruleSetHint}>
                  Select a rule set to configure the playoff bracket structure.
                </p>
              )}
            </div>
          </Card>

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
        <BracketRulesModal
          open={bracketRulesModalOpen}
          leagueId={leagueId}
          ruleSetId={bracketRuleSetId}
          bracketStructure={bracketStructure}
          groups={groups}
          onSave={async (savedId) => {
            if (savedId !== bracketRuleSetId) {
              await updateSeason(seasonId, { bracket_rule_set_id: savedId });
            }
          }}
          onClose={() => setBracketRulesModalOpen(false)}
        />

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
