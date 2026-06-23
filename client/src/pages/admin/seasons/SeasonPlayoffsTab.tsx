import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import Badge from '@/components/Badge/Badge';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import Field from '@/components/Field/Field';
import Icon from '@/components/Icon/Icon';
import InfoItem from '@/components/InfoItem/InfoItem';
import Modal from '@/components/Modal/Modal';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import {
  type PlayoffSeriesRecord,
  type SeriesStatus,
  usePlayoffSeries,
} from '@/hooks/useGames';
import { type PlayoffFormatRule } from '@/hooks/useLeagues';
import { type SeasonGroupRecord } from '@/hooks/useSeasonDetails';
import { type CreateSeasonData } from '@/hooks/useSeasons';
import Select from '@/components/Select/Select';
import useBracketRuleSets, { type BracketSlotRule } from '@/hooks/useBracketRuleSets';
import { type TeamStandingRecord } from '@/hooks/useSeasonStandings';
import { buildPlayoffSeriesDetailsPath } from '@/lib/routeSlugs';
import {
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

const standingTeamLabel = (team: TeamStandingRecord) =>
  team.team_name ?? team.team_code ?? team.team_id;

interface SimulatedSlotTeam {
  teamId: string;
  name: string;
  code: string;
  logo: string | null;
  primaryColor: string | null;
  textColor: string | null;
}

const simulatedTeamFromStanding = (team: TeamStandingRecord): SimulatedSlotTeam => ({
  teamId: team.team_id,
  name: standingTeamLabel(team),
  code: team.team_code ?? standingTeamLabel(team).slice(0, 3).toUpperCase(),
  logo: team.team_logo,
  primaryColor: team.team_primary_color,
  textColor: team.team_text_color,
});

export const canonicalSlotKey = (key: string | null | undefined): string | null => {
  if (!key) return null;
  return key.replace(/away$/, 'team1').replace(/home$/, 'team2');
};

export const normalizeBracketSlotRule = (slot: BracketSlotRule): BracketSlotRule => ({
  ...slot,
  slot_key: canonicalSlotKey(slot.slot_key) ?? slot.slot_key,
  choice_ref: canonicalSlotKey(slot.choice_ref),
  matchup_ref: slot.matchup_ref ? (canonicalSlotKey(slot.matchup_ref) ?? slot.matchup_ref) : null,
});

export const getSeasonGroupTeamIds = (
  groups: SeasonGroupRecord[],
  groupId: string,
): Set<string> => {
  const ids = new Set<string>();
  const groupMatches = (group: SeasonGroupRecord, id: string) =>
    group.id === id || group.stable_key === `legacy:${id}`;
  const collect = (gid: string) => {
    const group = groups.find((candidate) => groupMatches(candidate, gid));
    if (!group) return;
    group.teams.forEach((team) => ids.add(team.id));
    groups
      .filter((candidate) => candidate.parent_id === group.id)
      .forEach((child) => collect(child.id));
  };
  collect(groupId);
  return ids;
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

// ── Playoff Settings Modal ─────────────────────────────────────────────────────

interface PlayoffSettingsFormValues {
  best_of_playoff: string;
}

interface PlayoffSettingsModalProps {
  open: boolean;
  bestOfPlayoff: number | null;
  leagueBestOfPlayoff: number;
  seasonId: string;
  updateSeason: (id: string, payload: Partial<CreateSeasonData>) => Promise<boolean>;
  onClose: () => void;
}

const PlayoffSettingsModal = ({
  open,
  bestOfPlayoff,
  leagueBestOfPlayoff,
  seasonId,
  updateSeason,
  onClose,
}: PlayoffSettingsModalProps) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty, isValid },
  } = useForm<PlayoffSettingsFormValues>({
    defaultValues: { best_of_playoff: '' },
    mode: 'onChange',
  });

  useEffect(() => {
    if (!open) return;
    reset({
      best_of_playoff: bestOfPlayoff != null ? String(bestOfPlayoff) : '',
    });
  }, [open, bestOfPlayoff, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const ok = await updateSeason(seasonId, {
      best_of_playoff: data.best_of_playoff ? parseInt(data.best_of_playoff, 10) : null,
    });
    if (ok) onClose();
  });

  return (
    <Modal
      open={open}
      title="Playoff Settings"
      onClose={onClose}
      confirmLabel={isSubmitting ? 'Saving…' : 'Save Changes'}
      confirmForm="playoff-settings-form"
      confirmDisabled={isSubmitting || !isDirty || !isValid}
      busy={isSubmitting}
    >
      <form
        id="playoff-settings-form"
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
    formState: { isSubmitting, isDirty, isValid },
  } = useForm<PlayoffFormatFormValues>({
    defaultValues: { rules: [] },
    mode: 'onChange',
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
      confirmDisabled={isSubmitting || !isDirty || !isValid}
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
                rules={{
                  required: 'Count is required',
                  min: { value: 1, message: 'Count must be at least 1' },
                  max: { value: 32, message: 'Count must be 32 or less' },
                }}
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

// ── Choice Pick Modal ─────────────────────────────────────────────────────────

interface ChoiceCandidate {
  teamId: string;
  name: string;
}

interface ChoicePick {
  /** The slot key of the 'choice' slot (e.g. "r1m0home"). */
  choiceSlotKey: string;
  /** The seeded team that gets to pick, resolved from the companion slot. */
  chooserName: string | null;
  /** All candidate team names the chooser may pick from. */
  candidates: ChoiceCandidate[];
  /** The user's selection — null until chosen. */
  picked: string | null;
}

interface ChoicePickModalProps {
  open: boolean;
  choices: ChoicePick[];
  confirmLabel?: string;
  onConfirm: (picks: ChoicePick[]) => void | Promise<void>;
  onClose: () => void;
}

const ChoicePickModal = ({
  open,
  choices,
  confirmLabel = 'Apply Simulation',
  onConfirm,
  onClose,
}: ChoicePickModalProps) => {
  const [picks, setPicks] = useState<ChoicePick[]>([]);

  useEffect(() => {
    if (open) setPicks(choices.map((c) => ({ ...c, picked: null })));
  }, [open, choices]);

  // Build the set of all currently selected opponents to prevent the same team
  // being chosen by two different seeded teams.
  const pickedSet = new Set(picks.map((p) => p.picked).filter((p): p is string => p !== null));

  const handlePick = (index: number, value: string) => {
    setPicks((prev) => prev.map((p, i) => (i === index ? { ...p, picked: value } : p)));
  };

  const allResolved = picks.length > 0 && picks.every((p) => p.picked !== null);

  return (
    <Modal
      open={open}
      title="Opponent Picks"
      onClose={onClose}
      confirmLabel={confirmLabel}
      onConfirm={() => onConfirm(picks)}
      confirmDisabled={!allResolved}
    >
      <div className={styles.choicePickStack}>
        <p className={styles.choicePickHint}>
          The following seeded teams choose their first-round opponent. Each team may only be
          selected once.
        </p>
        {picks.map((pick, i) => {
          // Filter out any team already chosen by another picker, unless it is
          // the current picker's own selection (so they can change their mind).
          const options = pick.candidates
            .filter((c) => c.teamId === pick.picked || !pickedSet.has(c.teamId))
            .map((c) => ({ value: c.teamId, label: c.name }));

          return (
            <div
              key={pick.choiceSlotKey}
              className={styles.choicePickRow}
            >
              <span className={styles.choicePickChooser}>{pick.chooserName ?? 'TBD'}</span>
              <span className={styles.choicePickVerb}>picks</span>
              <div className={styles.choicePickSelect}>
                <Select
                  value={pick.picked}
                  options={options}
                  placeholder="Select opponent…"
                  onChange={(v) => handlePick(i, v)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
};

// ── Bracket Slot ──────────────────────────────────────────────────────────────

interface BracketSlotProps {
  series: PlayoffSeriesRecord | null;
  busy: string | null;
  seriesHref?: string;
  /** Simulated team name for Team 1 (home ice). Only shown when series is null. */
  simulatedTeam1?: string | null;
  simulatedTeam1Details?: SimulatedSlotTeam | null;
  /** Simulated team name for Team 2. Only shown when series is null. */
  simulatedTeam2?: string | null;
  simulatedTeam2Details?: SimulatedSlotTeam | null;
  /** True when both feeder series are complete and this slot has no series yet. */
  canAdvance?: boolean;
  /** True when this completed series' winner can be force-advanced to the next round. */
  canAdvanceWinner?: boolean;
  onStart: (s: PlayoffSeriesRecord) => void;
  /** Bulk advance (empty slot) — runs advance-bracket for the whole season. */
  onAdvance?: () => void;
  /** Targeted force-advance — advances this specific series' winner to the next round. */
  onForceAdvance?: () => void;
}

const BracketSlot = ({
  series,
  busy,
  seriesHref,
  simulatedTeam1,
  simulatedTeam1Details,
  simulatedTeam2,
  simulatedTeam2Details,
  canAdvance = false,
  canAdvanceWinner = false,
  onStart,
  onAdvance,
  onForceAdvance,
}: BracketSlotProps) => {
  const WinCount = ({ wins, show = true }: { wins: number; show?: boolean }) =>
    show ? (
      <span
        className={styles.slotWinCount}
        aria-label={`${wins} ${wins === 1 ? 'win' : 'wins'}`}
      >
        {wins}
      </span>
    ) : null;

  if (!series) {
    const team1Name = simulatedTeam1Details?.name ?? simulatedTeam1 ?? null;
    const team2Name = simulatedTeam2Details?.name ?? simulatedTeam2 ?? null;
    const isSimulated = team1Name != null || team2Name != null;

    return (
      <div
        className={[
          styles.bracketSlot,
          styles.slotFilled,
          isSimulated ? styles.slotSimulated : styles.slotEmptyMatchup,
          !canAdvance && !isSimulated ? styles.slotEmptyDisabled : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {canAdvance && onAdvance && (
          <div className={styles.slotActions}>
            <Button
              variant="filled"
              intent="accent"
              icon="sync"
              size="sm"
              tooltip="Create next-round series"
              disabled={busy === 'advancing'}
              onClick={onAdvance}
            />
          </div>
        )}
        <div className={`${styles.slotTeam} ${!team1Name ? styles.slotTeamTbd : ''}`}>
          {simulatedTeam1Details && (
            <TeamLogo
              logo={simulatedTeam1Details.logo}
              code={simulatedTeam1Details.code}
              alt={simulatedTeam1Details.name}
              primaryColor={simulatedTeam1Details.primaryColor}
              textColor={simulatedTeam1Details.textColor}
              size={20}
              shape="square"
            />
          )}
          <span className={styles.slotTeamName}>{team1Name ?? 'TBD'}</span>
          <WinCount
            wins={0}
            show={!!team1Name}
          />
        </div>
        <div className={styles.slotDivider} />
        <div className={`${styles.slotTeam} ${!team2Name ? styles.slotTeamTbd : ''}`}>
          {simulatedTeam2Details && (
            <TeamLogo
              logo={simulatedTeam2Details.logo}
              code={simulatedTeam2Details.code}
              alt={simulatedTeam2Details.name}
              primaryColor={simulatedTeam2Details.primaryColor}
              textColor={simulatedTeam2Details.textColor}
              size={20}
              shape="square"
            />
          )}
          <span className={styles.slotTeamName}>{team2Name ?? 'TBD'}</span>
          <WinCount
            wins={0}
            show={!!team2Name}
          />
        </div>
      </div>
    );
  }

  const homeWon = series.winner_team_id === series.home_team_id;
  const awayWon = series.winner_team_id === series.away_team_id;
  const isComplete = series.status === 'complete';

  const hasNoGames = (series.games ?? []).length === 0;
  const bothTeamsSet = !!series.home_team_id && !!series.away_team_id;
  const canStart = hasNoGames && series.status === 'upcoming' && bothTeamsSet;
  const showOverlay = canStart || canAdvanceWinner;

  return (
    <div className={`${styles.bracketSlot} ${styles.slotFilled}`}>
      {seriesHref && (
        <Link
          to={seriesHref}
          className={styles.slotLink}
          aria-label={`View ${series.away_team_code ?? 'away'} vs ${series.home_team_code ?? 'home'} series`}
        />
      )}
      {showOverlay && (
        <div className={styles.slotActions}>
          {canStart && (
            <Button
              variant="filled"
              intent="accent"
              icon="play_arrow"
              size="sm"
              tooltip="Start series"
              disabled={busy === series.id}
              onClick={() => onStart(series)}
            />
          )}
          {canAdvanceWinner && onForceAdvance && (
            <Button
              variant="filled"
              intent="accent"
              icon="arrow_forward"
              size="sm"
              tooltip="Advance winner to next round"
              disabled={!!busy}
              onClick={onForceAdvance}
            />
          )}
        </div>
      )}
      <div
        className={[
          styles.slotTeam,
          homeWon ? styles.slotTeamWinner : '',
          isComplete && !homeWon ? styles.slotTeamLoser : '',
          !series.home_team_id ? styles.slotTeamTbd : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {series.home_team_id && (
          <TeamLogo
            logo={series.home_team_logo}
            code={series.home_team_code}
            size={20}
            shape="square"
          />
        )}
        <span className={styles.slotTeamName}>{series.home_team_name ?? 'TBD'}</span>
        <WinCount
          wins={series.home_wins}
          show={!!series.home_team_id}
        />
      </div>
      <div className={styles.slotDivider} />
      <div
        className={[
          styles.slotTeam,
          awayWon ? styles.slotTeamWinner : '',
          isComplete && !awayWon ? styles.slotTeamLoser : '',
          !series.away_team_id ? styles.slotTeamTbd : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {series.away_team_id && (
          <TeamLogo
            logo={series.away_team_logo}
            code={series.away_team_code}
            size={20}
            shape="square"
          />
        )}
        <span className={styles.slotTeamName}>{series.away_team_name ?? 'TBD'}</span>
        <WinCount
          wins={series.away_wins}
          show={!!series.away_team_id}
        />
      </div>
    </div>
  );
};

// ── Main Tab Component ────────────────────────────────────────────────────────

interface Props {
  seasonId: string;
  leagueId: string;
  leagueCode: string | null | undefined;
  seasonName: string | null | undefined;
  bracketRuleSetId: string | null;
  groups: SeasonGroupRecord[];
  isEnded: boolean;
  /** True once the admin has formally ended the regular season. */
  playoffsStarted: boolean;
  playoffFormat: PlayoffFormatRule[] | null;
  bestOfPlayoff: number | null;
  leagueBestOfPlayoff: number;
  standings: TeamStandingRecord[];
  standingsLoading: boolean;
  updateSeason: (id: string, payload: Partial<CreateSeasonData>) => Promise<boolean>;
}

const SeasonPlayoffsTab = ({
  seasonId,
  leagueId,
  leagueCode,
  seasonName,
  bracketRuleSetId,
  groups,
  isEnded,
  playoffsStarted,
  playoffFormat,
  bestOfPlayoff,
  leagueBestOfPlayoff,
  standings,
  standingsLoading,
  updateSeason,
}: Props) => {
  const {
    series,
    loading: seriesLoading,
    busy: seriesBusy,
    createSeries,
    startSeries,
    advanceBracket,
    forceAdvance,
  } = usePlayoffSeries(seasonId);

  const { ruleSets, fetchRuleSet } = useBracketRuleSets(leagueId);
  const ruleSetOptions = ruleSets.map((rs) => ({ value: rs.id, label: rs.name }));
  const [draftBracketRuleSetId, setDraftBracketRuleSetId] = useState<string | null>(
    bracketRuleSetId,
  );
  const [savingBracketRuleSet, setSavingBracketRuleSet] = useState(false);

  useEffect(() => {
    setDraftBracketRuleSetId(bracketRuleSetId);
  }, [bracketRuleSetId]);

  // ── Active rule set slots (needed to compute advanceable slots) ───────────────
  const [activeRuleSetSlots, setActiveRuleSetSlots] = useState<BracketSlotRule[]>([]);
  useEffect(() => {
    if (!bracketRuleSetId) {
      setActiveRuleSetSlots([]);
      return;
    }
    fetchRuleSet(bracketRuleSetId).then((rs) =>
      setActiveRuleSetSlots(rs?.slots.map(normalizeBracketSlotRule) ?? []),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bracketRuleSetId]);

  /**
   * Set of matchup keys (e.g. 'r2m0') where both feeder series are complete
   * and no series for that slot exists yet — these empty slots can be advanced.
   */
  const advanceableSlots = useMemo(() => {
    if (!activeRuleSetSlots.length) return new Set<string>();
    const bySlotKey = new Map(
      series.filter((s) => s.bracket_slot_key).map((s) => [s.bracket_slot_key!, s]),
    );
    // Build matchupKey → [feederMatchupRef, …] from 'winner' rules
    const feedersFor = new Map<string, string[]>();
    for (const rule of activeRuleSetSlots) {
      if (rule.rule_type !== 'winner' || !rule.matchup_ref) continue;
      const mk = rule.slot_key.replace(/team[12]$/, '');
      if (!feedersFor.has(mk)) feedersFor.set(mk, []);
      feedersFor.get(mk)!.push(rule.matchup_ref);
    }
    const result = new Set<string>();
    for (const [mk, feeders] of feedersFor) {
      if (feeders.length < 2) continue;
      if (bySlotKey.has(mk)) continue; // series already exists
      if (feeders.every((f) => bySlotKey.get(f)?.status === 'complete')) result.add(mk);
    }
    return result;
  }, [activeRuleSetSlots, series]);

  // Build a name → team_id lookup so resolved slot names can be turned into IDs for createSeries.
  const teamIdByName = useMemo(
    () => new Map(standings.map((s) => [standingTeamLabel(s), s.team_id])),
    [standings],
  );
  const simulatedTeamById = useMemo(
    () => new Map(standings.map((s) => [s.team_id, simulatedTeamFromStanding(s)])),
    [standings],
  );
  const buildSimulatedSlotTeams = (slotTeamIds: Record<string, string | null>) =>
    Object.fromEntries(
      Object.entries(slotTeamIds).map(([slotKey, teamId]) => [
        slotKey,
        teamId ? (simulatedTeamById.get(teamId) ?? null) : null,
      ]),
    ) as Record<string, SimulatedSlotTeam | null>;

  // ── Simulation state ──────────────────────────────────────────────────────────
  const [simulatedSlots, setSimulatedSlots] = useState<Record<string, string | null> | null>(null);
  const [simulatedSlotTeams, setSimulatedSlotTeams] = useState<
    Record<string, SimulatedSlotTeam | null> | null
  >(null);
  const [simulating, setSimulating] = useState(false);

  // State for the opponent-pick step (used when 'choice' slots are present).
  const [pickModalOpen, setPickModalOpen] = useState(false);
  const [pendingChoices, setPendingChoices] = useState<ChoicePick[]>([]);
  const [partialSimResult, setPartialSimResult] = useState<Record<string, string | null>>({});
  const [partialSimResultTeamIds, setPartialSimResultTeamIds] = useState<
    Record<string, string | null>
  >({});
  const [pendingRuleSlots, setPendingRuleSlots] = useState<BracketSlotRule[]>([]);

  /**
   * Persists round 1 matchups to the database using the resolved slot map.
   * Called instead of setSimulatedSlots when playoffsStarted is true.
   */
  const commitRound1Matchups = async (
    slots: Record<string, string | null>,
    slotTeamIds: Record<string, string | null> = {},
  ) => {
    const matchupIndices = [
      ...new Set(
        Object.keys(slots)
          .map((k) => k.match(/^r1m(\d+)/)?.[1])
          .filter((v): v is string => v !== undefined),
      ),
    ]
      .map(Number)
      .sort((a, b) => a - b);

    await Promise.all(
      matchupIndices
        .map((mi) => {
          // Team 1 always holds home-ice advantage; Team 2 is the visitor.
          const team1Key = `r1m${mi}team1`;
          const team2Key = `r1m${mi}team2`;
          const team1Name = slots[team1Key];
          const team2Name = slots[team2Key];
          const team1Id =
            slotTeamIds[team1Key] ?? (team1Name != null ? teamIdByName.get(team1Name) : undefined);
          const team2Id =
            slotTeamIds[team2Key] ?? (team2Name != null ? teamIdByName.get(team2Name) : undefined);
          if (!team1Id || !team2Id || team1Id === team2Id) return null;
          return createSeries({
            season_id: seasonId,
            round: 1,
            home_team_id: team1Id,
            away_team_id: team2Id,
            bracket_slot_key: `r1m${mi}`,
          });
        })
        .filter((p): p is Promise<boolean> => p !== null),
    );
  };

  const handleSimulate = async () => {
    if (!bracketRuleSetId || standingsLoading || standings.length === 0) return;
    setSimulating(true);
    try {
      const ruleSet = await fetchRuleSet(bracketRuleSetId);
      if (!ruleSet) return;
      const ruleSlots = ruleSet.slots.map(normalizeBracketSlotRule);

      // First pass — resolve all 'seed' slots; leave everything else null for now.
      const scopedStandings = (
        scope: BracketSlotRule['scope'] | string | null,
        groupId?: string | null,
      ) => {
        if ((scope === 'specific_conference' || scope === 'specific_division') && groupId) {
          const ids = getSeasonGroupTeamIds(groups, groupId);
          return standings.filter((s) => ids.has(s.team_id));
        }
        return standings;
      };

      const pickSeedTeam = (
        rows: TeamStandingRecord[],
        rank: number | null,
        assignedTeamIds: Set<string>,
      ) => {
        const startIdx = Math.max((rank ?? 1) - 1, 0);
        return rows.slice(startIdx).find((team) => !assignedTeamIds.has(team.team_id)) ?? null;
      };

      const result: Record<string, string | null> = {};
      const resultTeamIds: Record<string, string | null> = {};
      const assignedTeamIds = new Set<string>();
      for (const slot of ruleSlots) {
        if (slot.rule_type !== 'seed') {
          result[slot.slot_key] = null;
          resultTeamIds[slot.slot_key] = null;
          continue;
        }
        const team = pickSeedTeam(
          scopedStandings(slot.scope, slot.group_id),
          slot.rank,
          assignedTeamIds,
        );
        result[slot.slot_key] = team ? standingTeamLabel(team) : null;
        resultTeamIds[slot.slot_key] = team?.team_id ?? null;
        if (team) {
          assignedTeamIds.add(team.team_id);
        }
      }

      // Check whether any slots require a human pick.
      const choiceSlots = ruleSlots.filter((s) => s.rule_type === 'choice');
      if (choiceSlots.length === 0) {
        if (playoffsStarted) {
          await commitRound1Matchups(result, resultTeamIds);
        } else {
          setSimulatedSlotTeams(buildSimulatedSlotTeams(resultTeamIds));
          setSimulatedSlots(result);
        }
        return;
      }

      // Build a pick entry for each 'choice' slot.
      // The "chooser" is the seeded team sitting in the companion position of the
      // same matchup (e.g. if the choice slot is r1m0team1, the chooser is r1m0team2).
      const choices: ChoicePick[] = choiceSlots.map((slot) => {
        const isTeam1 = slot.slot_key.endsWith('team1');
        const companionKey = isTeam1
          ? slot.slot_key.replace(/team1$/, 'team2')
          : slot.slot_key.replace(/team2$/, 'team1');
        const chooserName = result[companionKey] ?? null;

        // Resolve the candidate pool from standings, deduplicating when multiple
        // pool entries resolve to the same team.
        const seenCandidates = new Set<string>();
        const candidates = slot.pool
          .map((p) => {
            const filtered = scopedStandings(p.scope, p.group_id);
            const idx = (p.rank ?? 1) - 1;
            const team = filtered[idx] ?? null;
            if (!team || assignedTeamIds.has(team.team_id) || seenCandidates.has(team.team_id)) {
              return null;
            }
            seenCandidates.add(team.team_id);
            return { teamId: team.team_id, name: standingTeamLabel(team) };
          })
          .filter((candidate): candidate is ChoiceCandidate => candidate !== null);

        return { choiceSlotKey: slot.slot_key, chooserName, candidates, picked: null };
      });

      // Store the partial result and open the pick modal.
      setPartialSimResult(result);
      setPartialSimResultTeamIds(resultTeamIds);
      setPendingChoices(choices);
      setPendingRuleSlots(ruleSlots);
      setPickModalOpen(true);
    } finally {
      setSimulating(false);
    }
  };

  /**
   * Called when the user confirms all opponent picks in the ChoicePickModal.
   * Applies the chosen teams to 'choice' slots, then resolves 'unchosen' slots
   * by taking the first unassigned candidate from the referenced choice's pool.
   * When playoffsStarted, commits round 1 series directly instead of previewing.
   */
  const finalizeSimulation = async (picks: ChoicePick[]) => {
    const result = { ...partialSimResult };
    const resultTeamIds = { ...partialSimResultTeamIds };
    const assigned = new Set(
      Object.values(resultTeamIds).filter((v): v is string => v !== null),
    );

    // Apply each picker's choice.
    for (const pick of picks) {
      const picked = pick.candidates.find((candidate) => candidate.teamId === pick.picked) ?? null;
      if (!picked || assigned.has(picked.teamId)) {
        result[pick.choiceSlotKey] = null;
        resultTeamIds[pick.choiceSlotKey] = null;
        continue;
      }
      result[pick.choiceSlotKey] = picked.name;
      resultTeamIds[pick.choiceSlotKey] = picked.teamId;
      assigned.add(picked.teamId);
    }

    // Fill 'unchosen' slots: take the first candidate from the referenced choice's
    // pool that hasn't been placed anywhere yet.
    for (const slot of pendingRuleSlots) {
      if (slot.rule_type !== 'unchosen' || !slot.choice_ref) continue;
      const matchingPick = picks.find((p) => p.choiceSlotKey === slot.choice_ref);
      if (!matchingPick) {
        result[slot.slot_key] = null;
        resultTeamIds[slot.slot_key] = null;
        continue;
      }
      const unchosen =
        matchingPick.candidates.find((candidate) => !assigned.has(candidate.teamId)) ?? null;
      result[slot.slot_key] = unchosen?.name ?? null;
      resultTeamIds[slot.slot_key] = unchosen?.teamId ?? null;
      if (unchosen) assigned.add(unchosen.teamId);
    }

    if (playoffsStarted) {
      await commitRound1Matchups(result, resultTeamIds);
    } else {
      setSimulatedSlotTeams(buildSimulatedSlotTeams(resultTeamIds));
      setSimulatedSlots(result);
    }
    setPickModalOpen(false);
    setPendingChoices([]);
    setPartialSimResult({});
    setPartialSimResultTeamIds({});
    setPendingRuleSlots([]);
  };

  // ── Derived bracket structure ─────────────────────────────────────────────────
  const bracketStructure = useMemo(
    () => deriveBracketStructure(playoffFormat, groups),
    [playoffFormat, groups],
  );

  // Custom round names from the assigned rule set (null if none configured).
  const roundNames = useMemo(
    () =>
      bracketRuleSetId
        ? (ruleSets.find((rs) => rs.id === bracketRuleSetId)?.round_names ?? null)
        : null,
    [bracketRuleSetId, ruleSets],
  );

  // ── Modal state ───────────────────────────────────────────────────────────────
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [formatModalOpen, setFormatModalOpen] = useState(false);

  // ── Series state ─────────────────────────────────────────────────────────────
  const seriesByRound = series.reduce<Record<number, PlayoffSeriesRecord[]>>((acc, s) => {
    if (!acc[s.round]) acc[s.round] = [];
    acc[s.round].push(s);
    return acc;
  }, {});

  // Helper: extract matchup index from bracket_slot_key (e.g. 'r2m1' → 1)
  const matchupIndex = (s: PlayoffSeriesRecord) => {
    const m = s.bracket_slot_key?.match(/m(\d+)$/);
    return m ? Number(m[1]) : Infinity;
  };

  const handleStartSeries = (s: PlayoffSeriesRecord) => startSeries(s.id);
  const hasRoundOneSeries = series.some((s) => s.round === 1);
  const bracketRuleSetLocked = isEnded || playoffsStarted;
  const bracketRuleSetLabel =
    ruleSetOptions.find((option) => option.value === bracketRuleSetId)?.label ??
    'No rule set assigned';
  const bracketRuleSetLockedTitle = playoffsStarted
    ? 'Bracket rule set cannot be changed after playoffs start.'
    : 'Bracket rule set cannot be changed after the season ends.';
  const hasDraftBracketRuleSetChange = draftBracketRuleSetId !== bracketRuleSetId;
  const handleSaveBracketRuleSet = async () => {
    if (!hasDraftBracketRuleSetChange || !draftBracketRuleSetId) return;
    setSavingBracketRuleSet(true);
    try {
      await updateSeason(seasonId, { bracket_rule_set_id: draftBracketRuleSetId });
    } finally {
      setSavingBracketRuleSet(false);
    }
  };
  const canSimulateFirstRound =
    !!bracketStructure && !!bracketRuleSetId && !playoffsStarted && !hasRoundOneSeries;
  const canSeedMatchups =
    !!bracketStructure && !!bracketRuleSetId && playoffsStarted && !hasRoundOneSeries;
  const showBracketAction = canSimulateFirstRound || canSeedMatchups;
  const simulationStandingsUnavailable = standingsLoading || standings.length === 0;
  const playoffWinner = useMemo(() => {
    if (series.length === 0) return null;

    const finalRound =
      bracketStructure?.rounds[bracketStructure.rounds.length - 1]?.round ??
      Math.max(...series.map((s) => s.round));
    const finalSeries = series.find(
      (s) => s.round === finalRound && s.status === 'complete' && s.winner_team_id,
    );
    if (!finalSeries?.winner_team_id) return null;

    const winnerIsHome = finalSeries.winner_team_id === finalSeries.home_team_id;
    return {
      name: (winnerIsHome ? finalSeries.home_team_name : finalSeries.away_team_name) ?? 'TBD',
      code: (winnerIsHome ? finalSeries.home_team_code : finalSeries.away_team_code) ?? '',
      logo: winnerIsHome ? finalSeries.home_team_logo : finalSeries.away_team_logo,
      wins: winnerIsHome ? finalSeries.home_wins : finalSeries.away_wins,
      opponentWins: winnerIsHome ? finalSeries.away_wins : finalSeries.home_wins,
    };
  }, [bracketStructure, series]);
  const simulateTooltip = standingsLoading
    ? 'Loading standings'
    : simulationStandingsUnavailable
      ? 'Standings are required to seed matchups'
      : canSimulateFirstRound
        ? 'Uses current standings from final regular-season games'
        : undefined;
  const seriesDetailsPath = (s: PlayoffSeriesRecord) =>
    buildPlayoffSeriesDetailsPath({
      leagueCode,
      leagueId,
      seasonName,
      seasonId,
      seriesId: s.id,
      awayTeamCode: s.away_team_code,
      homeTeamCode: s.home_team_code,
    });

  return (
    <>
      {playoffsStarted && !isEnded && series.length === 0 && !seriesLoading && (
        <div className={styles.playoffsCallout}>
          <Icon
            name="emoji_events"
            size="1.1em"
          />
          <span>
            Regular season is over — use the <strong>Seed Matchups</strong> button or configure the
            bracket settings below to seed your playoff matchups.
          </span>
        </div>
      )}
      <div className={styles.layout}>
        {/* ── Left column — Playoff Bracket ── */}
        <div className={styles.layoutLeft}>
          {/* ── Playoff Series ── */}
          <Card
            title="Playoff Bracket"
            action={
              showBracketAction ? (
                simulatedSlots !== null ? (
                  <Button
                    variant="outlined"
                    intent="neutral"
                    icon="close"
                    size="sm"
                    onClick={() => {
                      setSimulatedSlots(null);
                      setSimulatedSlotTeams(null);
                    }}
                  >
                    Clear
                  </Button>
                ) : (
                  <Button
                    intent="success"
                    icon="play_arrow"
                    size="sm"
                    tooltip={simulateTooltip}
                    disabled={simulating || pickModalOpen || simulationStandingsUnavailable}
                    onClick={handleSimulate}
                  >
                    {canSeedMatchups ? 'Seed Matchups' : 'Simulate First Round'}
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
                  // Sort by bracket_slot_key matchup index so auto-advanced series
                  // always appear in the correct bracket position.
                  const roundSeries = [...(seriesByRound[roundInfo.round] ?? [])].sort(
                    (a, b) => matchupIndex(a) - matchupIndex(b),
                  );

                  // Fallback for legacy series without bracket_slot_key:
                  // an empty slot is advanceable when all previous-round series are complete.
                  const prevRound = seriesByRound[roundInfo.round - 1] ?? [];
                  const prevRoundAllComplete =
                    prevRound.length > 0 && prevRound.every((ps) => ps.status === 'complete');

                  // Is there a later round? Used to suppress the advance button on the final.
                  const hasNextRound = bracketStructure.rounds.some(
                    (r) => r.round > roundInfo.round,
                  );

                  return (
                    <div
                      key={roundInfo.round}
                      className={styles.bracketRound}
                    >
                      <p className={styles.bracketRoundLabel}>
                        {getRoundLabel(roundInfo.round, bracketStructure.rounds.length, roundNames)}
                      </p>
                      <div className={styles.bracketSlots}>
                        {Array.from({ length: roundInfo.series }, (_, slotIndex) => {
                          const slotKey = `r${roundInfo.round}m${slotIndex}`;
                          const s = roundSeries[slotIndex] ?? null;

                          // canAdvance: slot-key match OR legacy round-based fallback
                          const canAdvance =
                            advanceableSlots.has(slotKey) ||
                            (!s && roundInfo.round > 1 && prevRoundAllComplete);

                          // canAdvanceWinner: show on completed series when there's a next round
                          // and the winner hasn't already been placed in a next-round series.
                          const nextRoundSeries = seriesByRound[roundInfo.round + 1] ?? [];
                          const winnerAlreadyAdvanced =
                            !!s?.winner_team_id &&
                            nextRoundSeries.some(
                              (ns) =>
                                ns.home_team_id === s.winner_team_id ||
                                ns.away_team_id === s.winner_team_id,
                            );
                          const canAdvanceWinner =
                            s?.status === 'complete' && hasNextRound && !winnerAlreadyAdvanced;

                          return (
                            <BracketSlot
                              key={slotIndex}
                              series={s}
                              busy={seriesBusy}
                              seriesHref={s ? seriesDetailsPath(s) : undefined}
                              simulatedTeam1={
                                simulatedSlots?.[makeSlotKey(roundInfo.round, slotIndex, 'team1')]
                              }
                              simulatedTeam1Details={
                                simulatedSlotTeams?.[
                                  makeSlotKey(roundInfo.round, slotIndex, 'team1')
                                ]
                              }
                              simulatedTeam2={
                                simulatedSlots?.[makeSlotKey(roundInfo.round, slotIndex, 'team2')]
                              }
                              simulatedTeam2Details={
                                simulatedSlotTeams?.[
                                  makeSlotKey(roundInfo.round, slotIndex, 'team2')
                                ]
                              }
                              canAdvance={canAdvance}
                              canAdvanceWinner={canAdvanceWinner}
                              onStart={handleStartSeries}
                              onAdvance={advanceBracket}
                              onForceAdvance={s ? () => forceAdvance(s.id) : undefined}
                            />
                          );
                        })}
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
                        <p className={styles.roundLabel}>
                          {getRoundLabel(round, maxRound, roundNames)}
                        </p>
                        {seriesByRound[round].map((s) => (
                          <div
                            key={s.id}
                            className={styles.seriesRow}
                          >
                            <Link
                              to={seriesDetailsPath(s)}
                              className={styles.seriesRowLink}
                              aria-label={`View ${s.away_team_code ?? 'away'} vs ${s.home_team_code ?? 'home'} series`}
                            />
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
                              {s.games.length === 0 && s.status === 'upcoming' && (
                                <Button
                                  variant="ghost"
                                  intent="accent"
                                  icon="play_arrow"
                                  size="sm"
                                  tooltip="Start series"
                                  disabled={seriesBusy === s.id}
                                  onClick={() => handleStartSeries(s)}
                                />
                              )}
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
          <Card title="Playoff Winner">
            {seriesLoading ? (
              <p className={styles.playoffWinnerPending}>Loading...</p>
            ) : playoffWinner ? (
              <div className={styles.playoffWinnerShowcase}>
                <TeamLogo
                  logo={playoffWinner.logo}
                  code={playoffWinner.code}
                  size={96}
                  shape="square"
                  className={styles.playoffWinnerLogo}
                />
                <div className={styles.playoffWinnerDetails}>
                  <span className={styles.playoffWinnerName}>{playoffWinner.name}</span>
                  <span className={styles.playoffWinnerMeta}>
                    Champion - Final {playoffWinner.wins}-{playoffWinner.opponentWins}
                  </span>
                </div>
              </div>
            ) : (
              <p className={styles.playoffWinnerPending}>No winner yet.</p>
            )}
          </Card>

          {/* ── Bracket Rule Set ── */}
          <Card title="Bracket Rule Set">
            <div className={styles.ruleSetSelector}>
              {bracketRuleSetLocked ? (
                <div
                  className={styles.readonlyRuleSetBox}
                  title={bracketRuleSetLockedTitle}
                >
                  <span className={styles.readonlyRuleSetLabel}>{bracketRuleSetLabel}</span>
                </div>
              ) : (
              <div className={styles.ruleSetControl}>
                <div className={styles.ruleSetSelectField}>
              <Select
                value={draftBracketRuleSetId}
                options={ruleSetOptions}
                placeholder={
                  ruleSetOptions.length === 0
                    ? 'No rule sets — create one in the league Playoffs tab'
                    : 'Select a rule set…'
                }
                onChange={setDraftBracketRuleSetId}
                disabled={savingBracketRuleSet || ruleSetOptions.length === 0}
              />
                </div>
              {hasDraftBracketRuleSetChange && (
                <Button
                  type="button"
                  icon="save"
                  size="sm"
                  variant="filled"
                  intent="accent"
                  iconHeight="field"
                  tooltip="Save bracket rule set"
                  disabled={savingBracketRuleSet || !draftBracketRuleSetId}
                  onClick={handleSaveBracketRuleSet}
                />
              )}
              </div>
              )}
              {!draftBracketRuleSetId && ruleSetOptions.length > 0 && (
                <p className={styles.ruleSetHint}>
                  Select a rule set to configure the playoff bracket structure.
                </p>
              )}
            </div>
          </Card>

          {/* ── Playoff Settings ── */}
          <Card
            title="Playoff Settings"
            action={
              !playoffsStarted ? (
                <Button
                  variant="outlined"
                  intent="neutral"
                  icon="edit"
                  size="sm"
                  tooltip="Edit playoff settings"
                  disabled={isEnded}
                  onClick={() => setSettingsModalOpen(true)}
                />
              ) : null
            }
          >
            <div className={styles.settingsGrid}>
              <InfoItem
                label="Playoff Series Format"
                data={
                  bestOfPlayoff != null
                    ? `Best of ${bestOfPlayoff}`
                    : `Best of ${leagueBestOfPlayoff} (league default)`
                }
              />
            </div>
          </Card>

          {/* ── Playoff Qualification Format ── */}
          <Card
            title="Playoff Qualification Format"
            action={
              !playoffsStarted ? (
                <Button
                  variant="outlined"
                  intent="neutral"
                  icon="edit"
                  size="sm"
                  tooltip="Edit qualification format"
                  disabled={isEnded}
                  onClick={() => setFormatModalOpen(true)}
                />
              ) : null
            }
          >
            {playoffFormat && playoffFormat.length > 0 ? (
              <div className={styles.formatRuleList}>
                {playoffFormat.map((r, i) => (
                  <div
                    key={i}
                    className={styles.qualRuleRow}
                  >
                    <span className={styles.formatRuleStep}>{i + 1}</span>
                    <span className={styles.formatRuleText}>
                      {r.method === 'top'
                        ? `Top ${r.count}`
                        : `${r.count} wildcard${r.count !== 1 ? 's' : ''}`}
                    </span>
                    <Badge
                      label={
                        {
                          league: 'League',
                          conference: 'Per Conference',
                          division: 'Per Division',
                        }[r.scope]
                      }
                      intent="neutral"
                      className={styles.qualRuleBadge}
                    />
                  </div>
                ))}
              </div>
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

        <PlayoffSettingsModal
          open={settingsModalOpen}
          bestOfPlayoff={bestOfPlayoff}
          leagueBestOfPlayoff={leagueBestOfPlayoff}
          seasonId={seasonId}
          updateSeason={updateSeason}
          onClose={() => setSettingsModalOpen(false)}
        />

        <ChoicePickModal
          open={pickModalOpen}
          choices={pendingChoices}
          confirmLabel={playoffsStarted ? 'Seed Matchups' : 'Apply Simulation'}
          onConfirm={finalizeSimulation}
          onClose={() => {
            setPickModalOpen(false);
            setPendingChoices([]);
            setPartialSimResult({});
            setPartialSimResultTeamIds({});
            setPendingRuleSlots([]);
          }}
        />
      </>
    </>
  );
};

export default SeasonPlayoffsTab;
