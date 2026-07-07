import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Tag from '@/components/Tag/Tag';
import Button from '@/components/Button/Button';
import Chip from '@/components/Chip/Chip';
import Section from '@/components/Section/Section';
import InfoItem from '@/components/InfoItem/InfoItem';
import Icon from '@/components/Icon/Icon';
import ListItem from '@/components/ListItem/ListItem';
import Modal from '@/components/Modal/Modal';
import Skeleton from '@/components/Skeleton/Skeleton';
import TeamLogo from '@/components/TeamLogo/TeamLogo';
import Banner from '@/components/Banner/Banner';
import { type PlayoffSeriesRecord, type SeriesStatus, usePlayoffSeries } from '@/hooks/useGames';
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
  getMatchupLabel,
  getRoundLabel,
  makeSlotKey,
} from './BracketRulesModal';
import {
  getBracketSlotFooterLabel,
  getBracketSlotHeaderLabel,
} from './seasonPlayoffBracketLabels';
import { hasRecordedRegularSeasonGame } from './seasonPlayoffEligibility';
import styles from './SeasonPlayoffsTab.module.scss';

// ── Constants ──────────────────────────────────────────────────────────────────

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
  logoDark?: string | null;
  logoLight?: string | null;
  primaryColor: string | null;
  textColor: string | null;
}

const simulatedTeamFromStanding = (team: TeamStandingRecord): SimulatedSlotTeam => ({
  teamId: team.team_id,
  name: standingTeamLabel(team),
  code: team.team_code ?? standingTeamLabel(team).slice(0, 3).toUpperCase(),
  logo: team.team_logo,
  logoDark: team.team_logo_dark,
  logoLight: team.team_logo_light,
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

const BEST_OF_PLAYOFF_OPTIONS = [
  { value: '3', label: 'Best of 3' },
  { value: '5', label: 'Best of 5' },
  { value: '7', label: 'Best of 7' },
];

// ── Playoff Format Modal ──────────────────────────────────────────────────────

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
  slotRef?: (node: HTMLDivElement | null) => void;
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
  slotRef,
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
        ref={slotRef}
        className={[
          styles.bracketSlot,
          styles.slotFilled,
          // Only the advanceable empty slot is interactive; simulated and
          // disabled placeholders stay static (no hover border/text change).
          isSimulated
            ? styles.slotSimulated
            : canAdvance
              ? styles.slotEmptyMatchup
              : styles.slotEmptyDisabled,
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
              logoDark={simulatedTeam1Details.logoDark}
              logoLight={simulatedTeam1Details.logoLight}
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
              logoDark={simulatedTeam2Details.logoDark}
              logoLight={simulatedTeam2Details.logoLight}
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

  // Guard against null === null: a TBD slot with no winner must not read as won
  // (which would turn the missing slot green).
  const homeWon = !!series.winner_team_id && series.winner_team_id === series.home_team_id;
  const awayWon = !!series.winner_team_id && series.winner_team_id === series.away_team_id;
  const isComplete = series.status === 'complete';
  const homeSet = !!series.home_team_id;
  const awaySet = !!series.away_team_id;
  // A series that isn't fully seeded yet is treated like a tie: whichever team
  // is already filled is faded (the empty TBD slot keeps its normal styling).
  const partiallySeeded = (homeSet || awaySet) && !(homeSet && awaySet);
  // While a series is in progress, fade whichever team isn't leading yet (same
  // treatment as a completed loser); the leader keeps its normal styling.
  const isActive = series.status === 'active';
  const homeTrailing =
    (isActive && series.home_wins <= series.away_wins) || (partiallySeeded && homeSet);
  const awayTrailing =
    (isActive && series.away_wins <= series.home_wins) || (partiallySeeded && awaySet);

  const hasNoGames = (series.games ?? []).length === 0;
  const bothTeamsSet = homeSet && awaySet;
  const canStart = hasNoGames && series.status === 'upcoming' && bothTeamsSet;
  const showOverlay = canStart || canAdvanceWinner;

  return (
    <div
      ref={slotRef}
      className={[
        styles.bracketSlot,
        styles.slotFilled,
        // A real series box uses the bright bracket-line border even when not
        // fully filled; only a fully-seeded one is also interactive.
        styles.slotSeries,
        seriesHref && bothTeamsSet ? styles.slotInteractive : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {seriesHref && bothTeamsSet && (
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
          homeTrailing ? styles.slotTeamTrailing : '',
          !series.home_team_id ? styles.slotTeamTbd : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {series.home_team_id && (
          <TeamLogo
            logo={series.home_team_logo}
            logoDark={series.home_team_logo_dark}
            logoLight={series.home_team_logo_light}
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
          awayTrailing ? styles.slotTeamTrailing : '',
          !series.away_team_id ? styles.slotTeamTbd : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {series.away_team_id && (
          <TeamLogo
            logo={series.away_team_logo}
            logoDark={series.away_team_logo_dark}
            logoLight={series.away_team_logo_light}
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
  canStartPlayoffs?: boolean;
  startPlayoffsDisabled?: boolean;
  startPlayoffsBusy?: boolean;
  onStartPlayoffs?: () => void;
  updateSeason: (id: string, payload: Partial<CreateSeasonData>) => Promise<boolean>;
}

interface BracketConnectorPath {
  id: string;
  d: string;
  /** True once the next-round series this feeds into has been seeded. */
  active: boolean;
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
  canStartPlayoffs = false,
  startPlayoffsDisabled = false,
  startPlayoffsBusy = false,
  onStartPlayoffs,
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
  const currentPlayoffSeriesFormatValue = String(bestOfPlayoff ?? leagueBestOfPlayoff);
  const [draftBestOfPlayoff, setDraftBestOfPlayoff] = useState(currentPlayoffSeriesFormatValue);
  const [draftBracketRuleSetId, setDraftBracketRuleSetId] = useState<string | null>(
    bracketRuleSetId,
  );
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [savingPlayoffSettings, setSavingPlayoffSettings] = useState(false);
  const bracketCanvasRef = useRef<HTMLDivElement | null>(null);
  const bracketSlotRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [bracketConnectorPaths, setBracketConnectorPaths] = useState<BracketConnectorPath[]>([]);
  const [bracketOverlaySize, setBracketOverlaySize] = useState({ width: 0, height: 0 });

  const clearBracketConnectors = useCallback(() => {
    setBracketConnectorPaths((prev) => (prev.length === 0 ? prev : []));
    setBracketOverlaySize((prev) =>
      prev.width === 0 && prev.height === 0 ? prev : { width: 0, height: 0 },
    );
  }, []);

  const registerBracketSlot = useCallback(
    (slotKey: string) => (node: HTMLDivElement | null) => {
      if (node) {
        bracketSlotRefs.current[slotKey] = node;
      } else {
        delete bracketSlotRefs.current[slotKey];
      }
    },
    [],
  );

  useEffect(() => {
    setDraftBestOfPlayoff(currentPlayoffSeriesFormatValue);
  }, [currentPlayoffSeriesFormatValue]);

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
  const [simulatedSlotTeams, setSimulatedSlotTeams] = useState<Record<
    string,
    SimulatedSlotTeam | null
  > | null>(null);
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

      // When divisions feed the bracket, a conference-scoped seed is a wildcard:
      // it must be drawn from the teams left over after the division qualifiers,
      // and its rank N means the Nth such remaining team.
      const hasDivisionSeeds = ruleSlots.some(
        (s) =>
          s.rule_type === 'seed' && (s.scope === 'division' || s.scope === 'specific_division'),
      );
      const isPoolSlot = (slot: BracketSlotRule) =>
        hasDivisionSeeds && (slot.scope === 'conference' || slot.scope === 'specific_conference');

      const result: Record<string, string | null> = {};
      const resultTeamIds: Record<string, string | null> = {};
      const assignedTeamIds = new Set<string>();
      // Non-seed slots (choice/unchosen/winner) are resolved elsewhere/later.
      for (const slot of ruleSlots) {
        if (slot.rule_type !== 'seed') {
          result[slot.slot_key] = null;
          resultTeamIds[slot.slot_key] = null;
        }
      }

      const assignTeam = (slot: BracketSlotRule, team: TeamStandingRecord | null) => {
        result[slot.slot_key] = team ? standingTeamLabel(team) : null;
        resultTeamIds[slot.slot_key] = team?.team_id ?? null;
        if (team) assignedTeamIds.add(team.team_id);
      };

      const seedSlots = ruleSlots.filter((slot) => slot.rule_type === 'seed');

      // Pass 1 — direct qualifiers (e.g. division seeds). Rank N = the Nth team
      // in scope, skipping any already placed.
      for (const slot of seedSlots.filter((slot) => !isPoolSlot(slot))) {
        const rows = scopedStandings(slot.scope, slot.group_id);
        const idx = Math.max((slot.rank ?? 1) - 1, 0);
        assignTeam(slot, rows.slice(idx).find((t) => !assignedTeamIds.has(t.team_id)) ?? null);
      }

      // Pass 2 — wildcard pool seeds. Index rank into a fixed snapshot of the
      // teams remaining after the direct qualifiers, so rank N maps to the Nth
      // wildcard regardless of how many wildcards have already been placed.
      const poolBaseline = new Set(assignedTeamIds);
      for (const slot of seedSlots.filter((slot) => isPoolSlot(slot))) {
        const pool = scopedStandings(slot.scope, slot.group_id).filter(
          (t) => !poolBaseline.has(t.team_id),
        );
        const team = pool[Math.max((slot.rank ?? 1) - 1, 0)] ?? null;
        assignTeam(slot, team && !assignedTeamIds.has(team.team_id) ? team : null);
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
    const assigned = new Set(Object.values(resultTeamIds).filter((v): v is string => v !== null));

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
  const activeRuleSet = useMemo(
    () => (bracketRuleSetId ? (ruleSets.find((rs) => rs.id === bracketRuleSetId) ?? null) : null),
    [bracketRuleSetId, ruleSets],
  );
  const activePlayoffFormat =
    (activeRuleSet ? activeRuleSet.qualification_rules : playoffFormat) ?? null;
  const bracketStructure = useMemo(
    () => deriveBracketStructure(activePlayoffFormat, groups),
    [activePlayoffFormat, groups],
  );
  const roundNames = activeRuleSet?.round_names ?? null;
  const matchupNames = activeRuleSet?.matchup_names ?? null;

  // ── Modal state ───────────────────────────────────────────────────────────────
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

  // Show a skeleton in a slot while the backend is processing it: the series'
  // own slot while it's being started, and the next-round slot while a winner
  // is being advanced into it (rNmIdx → r(N+1)m(floor(Idx/2))).
  const [startingSeriesId, setStartingSeriesId] = useState<string | null>(null);
  const [advancingSeriesId, setAdvancingSeriesId] = useState<string | null>(null);
  const handleStartSeries = async (s: PlayoffSeriesRecord) => {
    setStartingSeriesId(s.id);
    try {
      await startSeries(s.id);
    } finally {
      setStartingSeriesId(null);
    }
  };
  const handleForceAdvance = async (s: PlayoffSeriesRecord) => {
    setAdvancingSeriesId(s.id);
    try {
      await forceAdvance(s.id);
    } finally {
      setAdvancingSeriesId(null);
    }
  };
  const skeletonSlotKeys = useMemo(() => {
    const keys = new Set<string>();
    const startingKey = series.find((x) => x.id === startingSeriesId)?.bracket_slot_key;
    if (startingKey) keys.add(startingKey);
    const advancing = series.find((x) => x.id === advancingSeriesId)?.bracket_slot_key;
    const m = advancing?.match(/^r(\d+)m(\d+)$/);
    if (m) keys.add(`r${Number(m[1]) + 1}m${Math.floor(Number(m[2]) / 2)}`);
    return keys;
  }, [startingSeriesId, advancingSeriesId, series]);

  const hasRoundOneSeries = series.some((s) => s.round === 1);
  const hasAnyRecordedRegularSeasonGame = hasRecordedRegularSeasonGame(standings);
  const playoffSettingsLocked = isEnded || playoffsStarted;
  const playoffSeriesFormatLabel =
    bestOfPlayoff != null
      ? `Best of ${bestOfPlayoff}`
      : `Best of ${leagueBestOfPlayoff} (league default)`;
  const playoffSettingsLockedTitle = playoffsStarted
    ? 'Playoff settings cannot be changed after playoffs start.'
    : 'Playoff settings cannot be changed after the season ends.';
  const playoffSettingsActionIcon = bracketRuleSetId ? 'edit' : 'add';
  const playoffSettingsActionTooltip = playoffSettingsLocked
    ? playoffSettingsLockedTitle
    : bracketRuleSetId
      ? 'Edit playoff settings'
      : 'Add playoff settings';
  const bracketRuleSetLabel =
    ruleSetOptions.find((option) => option.value === bracketRuleSetId)?.label ??
    'No rule set assigned';
  const qualificationScopeLabels = {
    league: 'League',
    conference: 'Conference',
    division: 'Division',
  } as const;
  const hasDraftPlayoffSettingsChange =
    draftBestOfPlayoff !== currentPlayoffSeriesFormatValue ||
    draftBracketRuleSetId !== bracketRuleSetId;
  const openPlayoffSettingsModal = () => {
    setDraftBestOfPlayoff(currentPlayoffSeriesFormatValue);
    setDraftBracketRuleSetId(bracketRuleSetId);
    setSettingsModalOpen(true);
  };
  const closePlayoffSettingsModal = () => {
    if (!savingPlayoffSettings) setSettingsModalOpen(false);
  };
  const handleSavePlayoffSettings = async () => {
    if (!hasDraftPlayoffSettingsChange) return;
    const playoffValue = parseInt(draftBestOfPlayoff, 10);
    setSavingPlayoffSettings(true);
    try {
      const saved = await updateSeason(seasonId, {
        bracket_rule_set_id: draftBracketRuleSetId,
        best_of_playoff: playoffValue !== leagueBestOfPlayoff ? playoffValue : null,
      });
      if (saved) setSettingsModalOpen(false);
    } finally {
      setSavingPlayoffSettings(false);
    }
  };
  const canSimulateFirstRound =
    !!bracketStructure &&
    !!bracketRuleSetId &&
    !playoffsStarted &&
    !hasRoundOneSeries &&
    (standingsLoading || hasAnyRecordedRegularSeasonGame);
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
      logoDark: winnerIsHome ? finalSeries.home_team_logo_dark : finalSeries.away_team_logo_dark,
      logoLight: winnerIsHome
        ? finalSeries.home_team_logo_light
        : finalSeries.away_team_logo_light,
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
  const bracketActionLabel = canSeedMatchups ? 'Seed Matchups' : 'Simulate First Round';
  const bracketActionTooltip = simulateTooltip
    ? `${bracketActionLabel}: ${simulateTooltip}`
    : bracketActionLabel;
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

  const measureBracketConnectors = useCallback(() => {
    const canvas = bracketCanvasRef.current;
    if (!canvas || !bracketStructure) {
      clearBracketConnectors();
      return;
    }

    const canvasRect = canvas.getBoundingClientRect();
    const slotUnderlap = 6;
    const nextPaths: BracketConnectorPath[] = [];

    // A feeder arm (and the stub into the next round) only lights up once that
    // feeder's winner has actually been advanced into the next-round series —
    // not merely when the feeder finished. This makes a half-advanced bracket
    // render half border / half bracket-colour.
    const seriesBySlot = new Map(
      series.filter((s) => s.bracket_slot_key).map((s) => [s.bracket_slot_key as string, s]),
    );

    const slotPoint = (slotKey: string, side: 'left' | 'right') => {
      const node = bracketSlotRefs.current[slotKey];
      if (!node) return null;

      const rect = node.getBoundingClientRect();
      return {
        x: (side === 'right' ? rect.right : rect.left) - canvasRect.left,
        y: rect.top - canvasRect.top + rect.height / 2,
      };
    };

    bracketStructure.rounds.slice(0, -1).forEach((roundInfo, roundIndex) => {
      const nextRound = bracketStructure.rounds[roundIndex + 1];
      if (!nextRound) return;

      Array.from({ length: Math.floor(roundInfo.series / 2) }, (_, pairIndex) => {
        const topKey = `r${roundInfo.round}m${pairIndex * 2}`;
        const bottomKey = `r${roundInfo.round}m${pairIndex * 2 + 1}`;
        const nextKey = `r${nextRound.round}m${pairIndex}`;
        const top = slotPoint(topKey, 'right');
        const bottom = slotPoint(bottomKey, 'right');
        const next = slotPoint(nextKey, 'left');
        if (!top || !bottom || !next) return;

        const joinX = top.x + (next.x - top.x) / 2;
        // Soften the bracket bends with a small corner radius (matches the
        // rounded series boxes), clamped so it never exceeds the available run.
        const r = Math.max(0, Math.min(8, (bottom.y - top.y) / 2, joinX - top.x, joinX - bottom.x));
        const baseId = `${topKey}-${bottomKey}-${nextKey}`;
        // A feeder's winner has advanced when it appears in the next series.
        const nextSeries = seriesBySlot.get(nextKey);
        const advancedIntoNext = (teamId: string | null | undefined) =>
          !!teamId &&
          !!nextSeries &&
          (nextSeries.home_team_id === teamId || nextSeries.away_team_id === teamId);
        const topAdvanced = advancedIntoNext(seriesBySlot.get(topKey)?.winner_team_id);
        const bottomAdvanced = advancedIntoNext(seriesBySlot.get(bottomKey)?.winner_team_id);
        // Top feeder arm + its half of the vertical spine (down to the branch).
        nextPaths.push({
          id: `${baseId}-top`,
          active: topAdvanced,
          d: `M ${top.x - slotUnderlap} ${top.y} H ${joinX - r} Q ${joinX} ${top.y} ${joinX} ${top.y + r} V ${next.y}`,
        });
        // Bottom feeder arm + its half of the spine (up to the branch).
        nextPaths.push({
          id: `${baseId}-bottom`,
          active: bottomAdvanced,
          d: `M ${bottom.x - slotUnderlap} ${bottom.y} H ${joinX - r} Q ${joinX} ${bottom.y} ${joinX} ${bottom.y - r} V ${next.y}`,
        });
        // Horizontal stub feeding the next-round series — bright once either
        // feeder's winner has been advanced into it.
        nextPaths.push({
          id: `${baseId}-next`,
          active: topAdvanced || bottomAdvanced,
          d: `M ${joinX} ${next.y} H ${next.x + slotUnderlap}`,
        });
      });
    });

    setBracketOverlaySize((prev) => {
      const next = {
        width: canvas.getBoundingClientRect().width,
        height: canvas.getBoundingClientRect().height,
      };
      return prev.width === next.width && prev.height === next.height ? prev : next;
    });
    setBracketConnectorPaths((prev) => {
      const same =
        prev.length === nextPaths.length &&
        prev.every(
          (path, index) =>
            path.id === nextPaths[index]?.id &&
            path.d === nextPaths[index]?.d &&
            path.active === nextPaths[index]?.active,
        );
      return same ? prev : nextPaths;
    });
  }, [bracketStructure, clearBracketConnectors, series]);

  useLayoutEffect(() => {
    const canvas = bracketCanvasRef.current;
    if (!canvas || !bracketStructure) {
      clearBracketConnectors();
      return;
    }

    let frame = 0;
    const scheduleMeasure = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measureBracketConnectors);
    };

    scheduleMeasure();
    window.addEventListener('resize', scheduleMeasure, { passive: true });

    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure);
    if (observer) {
      observer.observe(canvas);
      Object.values(bracketSlotRefs.current).forEach((node) => {
        if (node) observer.observe(node);
      });
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', scheduleMeasure);
      observer?.disconnect();
    };
  }, [bracketStructure, clearBracketConnectors, measureBracketConnectors, seriesLoading]);

  return (
    <>
      {canStartPlayoffs && !playoffsStarted && (
        <Banner
          intent="success"
          icon="emoji_events"
          title="Start Playoffs"
          closeable={false}
          className={styles.playoffsBanner}
          actions={
            <Button
              type="button"
              variant="filled"
              intent="success"
              icon="emoji_events"
              disabled={startPlayoffsDisabled}
              onClick={onStartPlayoffs}
            >
              {startPlayoffsBusy ? 'Starting…' : 'Start Playoffs'}
            </Button>
          }
        >
          Start playoffs when every regular-season game is final and every team has reached its
          season game target.
        </Banner>
      )}
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
          <Section
            title="Playoff Bracket"
            action={
              showBracketAction ? (
                simulatedSlots !== null ? (
                  <Button
                    variant="outlined"
                    intent="neutral"
                    icon="close"
                    size="medium"
                    onClick={() => {
                      setSimulatedSlots(null);
                      setSimulatedSlotTeams(null);
                    }}
                  >
                    Clear
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    intent="success"
                    icon="play_arrow"
                    iconHeight="button"
                    size="medium"
                    tooltip={bracketActionTooltip}
                    aria-label={bracketActionLabel}
                    disabled={simulating || pickModalOpen || simulationStandingsUnavailable}
                    onClick={handleSimulate}
                  />
                )
              ) : null
            }
          >
            {seriesLoading ? (
              <p className={styles.emptyState}>Loading…</p>
            ) : bracketStructure ? (
              <div className={styles.bracketGrid}>
                <div
                  ref={bracketCanvasRef}
                  className={styles.bracketCanvas}
                >
                  {bracketConnectorPaths.length > 0 && (
                    <svg
                      className={styles.bracketConnectorOverlay}
                      width={bracketOverlaySize.width}
                      height={bracketOverlaySize.height}
                      viewBox={`0 0 ${bracketOverlaySize.width} ${bracketOverlaySize.height}`}
                      aria-hidden="true"
                    >
                      {bracketConnectorPaths.map((path) => (
                        <path
                          key={path.id}
                          className={[
                            styles.bracketConnectorPath,
                            path.active ? styles.bracketConnectorPathActive : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          d={path.d}
                        />
                      ))}
                    </svg>
                  )}
                  {bracketStructure.rounds.map((roundInfo) => {
                    // Place each series in the slot matching its bracket_slot_key
                    // matchup index. Series without a slot key (legacy) fill any
                    // remaining slots in order. Indexing a sorted list positionally
                    // misplaced series when a round had gaps — e.g. a lone r2m3
                    // winner rendering in the r2m0 (series 1) slot.
                    const slotSeries: (PlayoffSeriesRecord | null)[] = Array.from(
                      { length: roundInfo.series },
                      () => null,
                    );
                    const unkeyedSeries: PlayoffSeriesRecord[] = [];
                    for (const ser of seriesByRound[roundInfo.round] ?? []) {
                      const idx = matchupIndex(ser);
                      if (
                        Number.isFinite(idx) &&
                        idx >= 0 &&
                        idx < slotSeries.length &&
                        !slotSeries[idx]
                      ) {
                        slotSeries[idx] = ser;
                      } else {
                        unkeyedSeries.push(ser);
                      }
                    }
                    for (let i = 0, p = 0; i < slotSeries.length && p < unkeyedSeries.length; i++) {
                      if (!slotSeries[i]) slotSeries[i] = unkeyedSeries[p++];
                    }

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
                        <div className={styles.bracketSlots}>
                          {Array.from({ length: roundInfo.series }, (_, slotIndex) => {
                            const slotKey = `r${roundInfo.round}m${slotIndex}`;
                            const s = slotSeries[slotIndex] ?? null;

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
                            const headerLabel = getBracketSlotHeaderLabel({
                              slotIndex,
                              slotKey,
                              round: roundInfo.round,
                              totalRounds: bracketStructure.rounds.length,
                              roundNames,
                              matchupNames,
                            });
                            const footerLabel = getBracketSlotFooterLabel({
                              slotIndex,
                              seriesCount: roundInfo.series,
                              round: roundInfo.round,
                              totalRounds: bracketStructure.rounds.length,
                              roundNames,
                            });

                            return (
                              <div
                                key={slotKey}
                                className={styles.bracketSlotGroup}
                              >
                                {headerLabel && (
                                  <span className={styles.bracketMatchupLabel}>{headerLabel}</span>
                                )}
                                {skeletonSlotKeys.has(slotKey) ? (
                                  <div
                                    ref={registerBracketSlot(slotKey)}
                                    className={`${styles.bracketSlot} ${styles.slotSkeleton}`}
                                    aria-label="Processing…"
                                  >
                                    <Skeleton
                                      type="block"
                                      className={styles.slotSkeletonBar}
                                    />
                                  </div>
                                ) : (
                                  <BracketSlot
                                    series={s}
                                    busy={seriesBusy}
                                    seriesHref={s ? seriesDetailsPath(s) : undefined}
                                    slotRef={registerBracketSlot(slotKey)}
                                    simulatedTeam1={
                                      simulatedSlots?.[
                                        makeSlotKey(roundInfo.round, slotIndex, 'team1')
                                      ]
                                    }
                                    simulatedTeam1Details={
                                      simulatedSlotTeams?.[
                                        makeSlotKey(roundInfo.round, slotIndex, 'team1')
                                      ]
                                    }
                                    simulatedTeam2={
                                      simulatedSlots?.[
                                        makeSlotKey(roundInfo.round, slotIndex, 'team2')
                                      ]
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
                                    onForceAdvance={s ? () => handleForceAdvance(s) : undefined}
                                  />
                                )}
                                {footerLabel && (
                                  <span className={styles.bracketMatchupLabel}>{footerLabel}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
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
                        {seriesByRound[round].map((s) => {
                          const matchupLabel = getMatchupLabel(
                            s.bracket_slot_key ?? '',
                            matchupNames,
                          );
                          return (
                            <div
                              key={s.id}
                              className={styles.seriesRow}
                            >
                              <Link
                                to={seriesDetailsPath(s)}
                                className={styles.seriesRowLink}
                                aria-label={`View ${s.away_team_code ?? 'away'} vs ${s.home_team_code ?? 'home'} series`}
                              />
                              {matchupLabel && (
                                <span className={styles.seriesMatchupLabel}>{matchupLabel}</span>
                              )}
                              <span className={styles.seriesTeams}>
                                {s.away_team_name} @ {s.home_team_name}
                                {s.series_letter && <> &nbsp;({s.series_letter})</>}
                              </span>
                              <span className={styles.seriesScore}>
                                {s.away_wins}–{s.home_wins}
                              </span>
                              <Tag
                                label={STATUS_LABEL[s.status]}
                                intent={STATUS_INTENT[s.status]}
                              />
                              <div className={styles.seriesRowActions}>
                                {s.games.length === 0 && s.status === 'upcoming' && (
                                  <Button
                                    variant="ghost"
                                    intent="accent"
                                    icon="play_arrow"
                                    tooltip="Start series"
                                    disabled={seriesBusy === s.id}
                                    onClick={() => handleStartSeries(s)}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
              </div>
            )}
          </Section>
        </div>

        {/* ── Right column — Playoff settings ── */}
        <div className={styles.layoutRight}>
          {playoffWinner && (
            <Section title="Playoff Winner">
              <div className={styles.playoffWinnerShowcase}>
                <TeamLogo
                  logo={playoffWinner.logo}
                  logoDark={playoffWinner.logoDark}
                  logoLight={playoffWinner.logoLight}
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
            </Section>
          )}

          <Section
            title="Playoff Settings"
            action={
              <Button
                type="button"
                icon={playoffSettingsActionIcon}
                size="medium"
                variant="outlined"
                intent="neutral"
                tooltip={playoffSettingsActionTooltip}
                disabled={playoffSettingsLocked || savingPlayoffSettings}
                onClick={openPlayoffSettingsModal}
              />
            }
          >
            <div className={styles.playoffSettingsGrid}>
              <InfoItem
                label="Playoff Rule Set"
                data={bracketRuleSetLabel}
              />
              <InfoItem
                label="Series Format"
                data={playoffSeriesFormatLabel}
              />
              <InfoItem
                type="custom"
                label="Qualification Rules"
                full
              >
                {activePlayoffFormat && activePlayoffFormat.length > 0 ? (
                  <ul className={styles.playoffSettingsQualificationList}>
                    {activePlayoffFormat.map((r, i) => (
                      <ListItem
                        key={`${r.scope}-${r.method}-${r.count}-${i}`}
                        size="compact"
                        preTextContent={<Chip size="small">{i + 1}</Chip>}
                        name={
                          r.method === 'top'
                            ? `Top ${r.count} team${r.count !== 1 ? 's' : ''}`
                            : `${r.count} wildcard team${r.count !== 1 ? 's' : ''}`
                        }
                        rightContent={{
                          type: 'tag',
                          label: qualificationScopeLabels[r.scope],
                          intent: 'info',
                        }}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className={styles.formatEmpty}>
                    No rules configured - qualification is managed manually.
                  </p>
                )}
              </InfoItem>
            </div>
          </Section>
        </div>
      </div>

      {/* ── Modals ── */}
      <>
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
        <Modal
          open={settingsModalOpen}
          title="Edit Playoff Settings"
          onClose={closePlayoffSettingsModal}
          confirmLabel={savingPlayoffSettings ? 'Saving...' : 'Save Changes'}
          confirmIcon="save"
          onConfirm={handleSavePlayoffSettings}
          confirmDisabled={savingPlayoffSettings || !hasDraftPlayoffSettingsChange}
          busy={savingPlayoffSettings}
        >
          <div className={styles.playoffSettingsForm}>
            <label className={styles.playoffSettingsField}>
              <span>Playoff Rule Set</span>
              <Select
                value={draftBracketRuleSetId}
                options={ruleSetOptions}
                placeholder={
                  ruleSetOptions.length === 0
                    ? 'No rule sets - create one in the league Playoffs tab'
                    : 'Select a rule set...'
                }
                emptyMessage="No rule sets available"
                onChange={setDraftBracketRuleSetId}
                disabled={savingPlayoffSettings || ruleSetOptions.length === 0}
              />
            </label>
            <label className={styles.playoffSettingsField}>
              <span>Series Format</span>
              <Select
                value={draftBestOfPlayoff}
                options={BEST_OF_PLAYOFF_OPTIONS}
                onChange={setDraftBestOfPlayoff}
                disabled={savingPlayoffSettings}
              />
            </label>
          </div>
        </Modal>
      </>
    </>
  );
};

export default SeasonPlayoffsTab;
