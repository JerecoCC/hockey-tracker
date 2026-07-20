import { useEffect, useState } from 'react';
import Accordion from '@jerecocc/tracker-ui/components/Accordion/Accordion';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import ConfirmModal from '@jerecocc/tracker-ui/components/ConfirmModal/ConfirmModal';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import ListItem from '@jerecocc/tracker-ui/components/ListItem/ListItem';
import SegmentedControl from '@jerecocc/tracker-ui/components/SegmentedControl/SegmentedControl';
import TeamLogo from '@jerecocc/tracker-ui/components/TeamLogo/TeamLogo';
import useTeamPlayers from '@/hooks/useTeamPlayers';
import useGameLineup, { type LineupEntry } from '@/hooks/useGameLineup';
import { type GameRosterEntry } from '@/hooks/useGameRoster';
import { type GameRecord } from '@/hooks/useGames';
import { POSITION_LABEL } from '../constants';
import LineupRosterModal from './LineupRosterModal';
import LineupCreatePlayersModal from './LineupCreatePlayersModal';
import SetLineupModal from './SetLineupModal';
import RemoveFromLineupModal from './RemoveFromLineupModal';
import ResponsiveList from '@/shared/ResponsiveList/ResponsiveList';
import styles from '../GameDetailsPage.module.scss';
import { playerDataComplete } from '../gameUtils';
import { scheduledDateInputValue } from '../formatUtils';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  game: GameRecord;
  isEditMode: boolean;
  readOnly?: boolean;
  showPlayerDataStatus?: boolean;
  isFinal: boolean;
  leagueId: string;
  seasonId: string | undefined;
  playerHrefBuilder?: (
    teamId: string,
    playerId: string,
    firstName: string | null | undefined,
    lastName: string | null | undefined,
    jerseyNumber?: number | null,
  ) => string;
  awayRoster: GameRosterEntry[];
  homeRoster: GameRosterEntry[];
  awayRosterInherited: GameRosterEntry[];
  homeRosterInherited: GameRosterEntry[];
  lineup: LineupEntry[];
  saveTeamLineup: ReturnType<typeof useGameLineup>['saveTeamLineup'];
  addToRoster: (teamId: string, playerIds: string[]) => Promise<boolean>;
  removeFromRoster: (entryId: string) => Promise<boolean>;
}

// ── Component ─────────────────────────────────────────────────────────────────

const GameLineupsTab = ({
  game,
  isEditMode,
  readOnly = false,
  showPlayerDataStatus = false,
  isFinal,
  leagueId,
  seasonId,
  playerHrefBuilder,
  awayRoster,
  homeRoster,
  awayRosterInherited,
  homeRosterInherited,
  lineup,
  saveTeamLineup,
  addToRoster,
  removeFromRoster,
}: Props) => {
  const [autoFillBusy, setAutoFillBusy] = useState<{ away: boolean; home: boolean }>({
    away: false,
    home: false,
  });
  const [lineupAddTeam, setLineupAddTeam] = useState<'away' | 'home' | null>(null);
  const [lineupCreateTeam, setLineupCreateTeam] = useState<'away' | 'home' | null>(null);
  const [createWithJerseys, setCreateWithJerseys] = useState<{
    team: 'away' | 'home';
    jerseys: number[];
  } | null>(null);
  const [lineupSetTeam, setLineupSetTeam] = useState<'away' | 'home' | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ entry: GameRosterEntry } | null>(null);
  const [confirmFinalCorrection, setConfirmFinalCorrection] = useState(false);
  const [finalLineupCorrection, setFinalLineupCorrection] = useState(false);
  const [removingFromRoster, setRemovingFromRoster] = useState(false);
  const [addingStarterPlayerId, setAddingStarterPlayerId] = useState<string | null>(null);
  const [visibleTeam, setVisibleTeam] = useState<'away' | 'home'>('away');

  const canOfferFinalLineupCorrection = !readOnly && isEditMode && isFinal;
  const finalLineupCorrectionActive = canOfferFinalLineupCorrection && finalLineupCorrection;
  const lineupActionsLocked = readOnly || (isFinal && !finalLineupCorrectionActive);

  useEffect(() => {
    if (canOfferFinalLineupCorrection) return;
    setFinalLineupCorrection(false);
    setConfirmFinalCorrection(false);
  }, [canOfferFinalLineupCorrection]);

  const { createAndRosterPlayers: createAndRosterAway } = useTeamPlayers(
    game.away_team.id,
    seasonId,
  );
  const { createAndRosterPlayers: createAndRosterHome } = useTeamPlayers(
    game.home_team.id,
    seasonId,
  );

  const awayLineupMap = new Map(
    lineup
      .filter((e) => e.team_id === game.away_team.id && e.position_slot === 'G')
      .map((e) => [e.player_id, e]),
  );
  const homeLineupMap = new Map(
    lineup
      .filter((e) => e.team_id === game.home_team.id && e.position_slot === 'G')
      .map((e) => [e.player_id, e]),
  );

  const handleConfirmRemove = async () => {
    if (!confirmRemove) return;
    setRemovingFromRoster(true);
    await removeFromRoster(confirmRemove.entry.id);
    setRemovingFromRoster(false);
    setConfirmRemove(null);
  };

  const handleConfirmFinalCorrection = () => {
    setFinalLineupCorrection(true);
    setConfirmFinalCorrection(false);
  };

  const handleSetStartingGoalie = async (player: GameRosterEntry, teamName: string) => {
    if (player.position !== 'G') return;
    setAddingStarterPlayerId(player.player_id);
    try {
      await saveTeamLineup(
        player.team_id,
        [{ position_slot: 'G', player_id: player.player_id }],
        teamName,
      );
    } finally {
      setAddingStarterPlayerId(null);
    }
  };

  const renderTeamAccordion = (
    side: 'away' | 'home',
    teamName: string,
    teamCode: string,
    teamLogo: string | null | undefined,
    teamLogoDark: string | null | undefined,
    teamLogoLight: string | null | undefined,
    primaryColor: string,
    textColor: string,
    rosterEntries: GameRosterEntry[],
    lineupMap: typeof awayLineupMap,
    inheritedEntries: GameRosterEntry[],
  ) => (
    <Accordion
      mode="static"
      variant="light"
      bodyClassName={styles.lineupAccordionBody}
      label={
        <span className={styles.accordionTeamLabel}>
          <TeamLogo
            logo={teamLogo ?? null}
            logoDark={teamLogoDark}
            logoLight={teamLogoLight}
            code={teamCode}
            primaryColor={primaryColor}
            textColor={textColor}
            size={20}
            shape="square"
          />
          {teamName}
        </span>
      }
      labelMeta={<span className={styles.accordionTeamCount}>({rosterEntries.length}/23)</span>}
      hoverActions={
        lineupActionsLocked
          ? []
          : [
              ...(inheritedEntries.length > 0 && rosterEntries.length === 0
                ? [
                    {
                      icon: 'clone',
                      tooltip: 'Auto-fill from Last Game',
                      intent: 'neutral' as const,
                      disabled: autoFillBusy[side],
                      onClick: async () => {
                        const teamId = side === 'away' ? game.away_team.id : game.home_team.id;
                        setAutoFillBusy((prev) => ({ ...prev, [side]: true }));
                        await addToRoster(
                          teamId,
                          inheritedEntries.map((e) => e.player_id),
                        );
                        setAutoFillBusy((prev) => ({ ...prev, [side]: false }));
                      },
                    },
                  ]
                : []),
              ...(rosterEntries.length < 23
                ? [
                    {
                      icon: 'person_edit',
                      tooltip: 'Create Player',
                      intent: 'neutral' as const,
                      onClick: () => setLineupCreateTeam(side),
                    },
                  ]
                : []),
              ...(rosterEntries.some((entry) => entry.position === 'G')
                ? [
                    {
                      icon: 'set_lineup',
                      tooltip: 'Set Starting Goalie',
                      intent: 'accent' as const,
                      onClick: () => setLineupSetTeam(side),
                    },
                  ]
                : []),
              ...(rosterEntries.length < 23
                ? [
                    {
                      icon: 'group_add',
                      tooltip: 'Add from Season Roster',
                      variant: 'filled' as const,
                      intent: 'accent' as const,
                      onClick: () => setLineupAddTeam(side),
                    },
                  ]
                : []),
            ]
      }
    >
      {rosterEntries.length > 0 ? (
        (() => {
          const byJersey = (a: GameRosterEntry, b: GameRosterEntry) => {
            if (a.jersey_number == null && b.jersey_number == null) return 0;
            if (a.jersey_number == null) return 1;
            if (b.jersey_number == null) return -1;
            return a.jersey_number - b.jersey_number;
          };
          const skaters = rosterEntries.filter((e) => e.position !== 'G').sort(byJersey);
          const goalies = rosterEntries.filter((e) => e.position === 'G').sort(byJersey);

          const renderPlayer = (e: GameRosterEntry) => {
            const isStartingGoalie = lineupMap.has(e.player_id);
            const canSetStartingGoalie = e.position === 'G' && !isStartingGoalie;
            const positionPart = e.position
              ? (POSITION_LABEL[e.position] ?? e.position)
              : undefined;
            return (
              <ListItem
                key={e.id}
                fullWidth
                className={styles.lineupPlayerItem}
                variant="plain"
                image={e.photo}
                imageShape="circle"
                hideImage
                primaryColor={primaryColor}
                textColor={textColor}
                chip={e.jersey_number != null ? { label: e.jersey_number } : null}
                subtitle={positionPart}
                name={`${e.last_name}, ${e.first_name} ${playerDataComplete(
                  e.date_of_birth,
                  e.start_date,
                  e.acquisition_type,
                  showPlayerDataStatus,
                )}`}
                placeholder={`${e.first_name[0]}${e.last_name[0]}`}
                href={playerHrefBuilder?.(
                  e.team_id,
                  e.player_id,
                  e.first_name,
                  e.last_name,
                  e.jersey_number,
                )}
                rightContent={
                  isStartingGoalie
                    ? { type: 'tag', label: 'Starting Goalie', intent: 'accent' }
                    : undefined
                }
                actions={
                  lineupActionsLocked
                    ? []
                    : [
                        canSetStartingGoalie && {
                          icon: 'set_lineup',
                          intent: 'accent',
                          tooltip: 'Set as starting goalie',
                          disabled: addingStarterPlayerId !== null,
                          onClick: () => handleSetStartingGoalie(e, teamName),
                        },
                        {
                          icon: 'person_remove',
                          intent: 'danger',
                          tooltip: 'Remove from lineup',
                          onClick: () => setConfirmRemove({ entry: e }),
                        },
                      ]
                }
              />
            );
          };

          return (
            <>
            <ResponsiveList className={styles.lineupPlayerList}>{skaters.map(renderPlayer)}</ResponsiveList>
              {goalies.length > 0 && (
                <>
                  <div className={styles.lineupDivider} />
            <ResponsiveList className={styles.lineupPlayerList}>{goalies.map(renderPlayer)}</ResponsiveList>
                </>
              )}
            </>
          );
        })()
      ) : (
        <p className={styles.noGoalsText}>No players in lineup yet.</p>
      )}
    </Accordion>
  );

  return (
    <>
      <div className={styles.tabContent}>
        <Section
          title="Lineups"
          action={
            <div className={styles.lineupActionBar}>
              {canOfferFinalLineupCorrection && (
                <Button
                  size="medium"
                  variant="outlined"
                  intent={finalLineupCorrectionActive ? 'neutral' : 'warning'}
                  icon={finalLineupCorrectionActive ? 'check' : 'edit'}
                  iconHeight="button"
                  tooltip={
                    finalLineupCorrectionActive ? 'Done Correcting' : 'Correct Final Starting Goalie'
                  }
                  aria-label={
                    finalLineupCorrectionActive ? 'Done Correcting' : 'Correct Final Starting Goalie'
                  }
                  onClick={() => {
                    if (finalLineupCorrectionActive) {
                      setFinalLineupCorrection(false);
                      return;
                    }
                    setConfirmFinalCorrection(true);
                  }}
                />
              )}
              <div className={styles.lineupMobileToggle}>
                <SegmentedControl
                  value={visibleTeam}
                  onChange={(value) => setVisibleTeam(value as 'away' | 'home')}
                  options={[
                    {
                      value: 'away',
                      label: game.away_team.code,
                      tooltip: game.away_team.name,
                    },
                    {
                      value: 'home',
                      label: game.home_team.code,
                      tooltip: game.home_team.name,
                    },
                  ]}
                  className={styles.lineupMobileToggleControl}
                />
              </div>
            </div>
          }
        >
          <div className={styles.lineupGrid}>
            <div
              className={[
                styles.lineupTeamPanel,
                visibleTeam !== 'away' && styles.lineupTeamPanelMobileHidden,
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {renderTeamAccordion(
                'away',
                game.away_team.name,
                game.away_team.code,
                game.away_team.logo,
                game.away_team.logo_dark,
                game.away_team.logo_light,
                game.away_team.primary_color,
                game.away_team.text_color,
                awayRoster,
                awayLineupMap,
                awayRosterInherited,
              )}
            </div>
            <div
              className={[
                styles.lineupTeamPanel,
                visibleTeam !== 'home' && styles.lineupTeamPanelMobileHidden,
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {renderTeamAccordion(
                'home',
                game.home_team.name,
                game.home_team.code,
                game.home_team.logo,
                game.home_team.logo_dark,
                game.home_team.logo_light,
                game.home_team.primary_color,
                game.home_team.text_color,
                homeRoster,
                homeLineupMap,
                homeRosterInherited,
              )}
            </div>
          </div>
        </Section>
      </div>

      {/* ── Add from Roster ── */}
      {!lineupActionsLocked && lineupAddTeam !== null && (
        <LineupRosterModal
          open={lineupAddTeam !== null}
          onClose={() => setLineupAddTeam(null)}
          teamId={lineupAddTeam === 'away' ? game.away_team.id : game.home_team.id}
          seasonId={seasonId!}
          gameDate={scheduledDateInputValue(game.scheduled_at)}
          teamName={lineupAddTeam === 'away' ? game.away_team.name : game.home_team.name}
          existingPlayerIds={
            new Set((lineupAddTeam === 'away' ? awayRoster : homeRoster).map((e) => e.player_id))
          }
          addToGameRoster={(playerIds) =>
            addToRoster(lineupAddTeam === 'away' ? game.away_team.id : game.home_team.id, playerIds)
          }
          onMissingJerseys={(jerseys) => {
            const team = lineupAddTeam!;
            setLineupAddTeam(null);
            setCreateWithJerseys({ team, jerseys });
            setLineupCreateTeam(team);
          }}
        />
      )}

      {/* ── Create Player ── */}
      {!lineupActionsLocked && lineupCreateTeam !== null && (
        <LineupCreatePlayersModal
          open={lineupCreateTeam !== null}
          onClose={() => {
            setLineupCreateTeam(null);
            setCreateWithJerseys(null);
          }}
          initialJerseyNumbers={
            createWithJerseys?.team === lineupCreateTeam ? createWithJerseys.jerseys : undefined
          }
          teamId={lineupCreateTeam === 'away' ? game.away_team.id : game.home_team.id}
          leagueId={leagueId}
          seasonId={seasonId!}
          teamName={lineupCreateTeam === 'away' ? game.away_team.name : game.home_team.name}
          existingCount={(lineupCreateTeam === 'away' ? awayRoster : homeRoster).length}
          existingGoalieCount={
            (lineupCreateTeam === 'away' ? awayRoster : homeRoster).filter(
              (e) => e.position === 'G',
            ).length
          }
          existingRoster={(lineupCreateTeam === 'away' ? awayRoster : homeRoster).map((e) => ({
            first_name: e.first_name,
            last_name: e.last_name,
            jersey_number: e.jersey_number ?? null,
          }))}
          createAndRosterPlayers={
            lineupCreateTeam === 'away' ? createAndRosterAway : createAndRosterHome
          }
          onPlayersCreated={(playerIds) =>
            addToRoster(
              lineupCreateTeam === 'away' ? game.away_team.id : game.home_team.id,
              playerIds,
            ).then(() => {})
          }
        />
      )}

      {/* ── Set Starting Goalie ── */}
      {!lineupActionsLocked &&
        lineupSetTeam !== null &&
        (() => {
          const sideTeam = lineupSetTeam === 'away' ? game.away_team : game.home_team;
          const rosterForSide = (lineupSetTeam === 'away' ? awayRoster : homeRoster).map((e) => ({
            ...e,
            id: e.player_id,
            primary_color: sideTeam.primary_color,
            text_color: sideTeam.text_color,
          }));
          return (
            <SetLineupModal
              open={lineupSetTeam !== null}
              onClose={() => setLineupSetTeam(null)}
              teamId={lineupSetTeam === 'away' ? game.away_team.id : game.home_team.id}
              teamName={lineupSetTeam === 'away' ? game.away_team.name : game.home_team.name}
              players={rosterForSide as unknown as Parameters<typeof SetLineupModal>[0]['players']}
              lineup={lineup}
              saveTeamLineup={saveTeamLineup}
              correctionMode={finalLineupCorrectionActive}
            />
          );
        })()}

      {/* ── Remove from Lineup ── */}
      {!lineupActionsLocked && (
        <RemoveFromLineupModal
          entry={confirmRemove?.entry ?? null}
          busy={removingFromRoster}
          onConfirm={handleConfirmRemove}
          onCancel={() => setConfirmRemove(null)}
        />
      )}

      {canOfferFinalLineupCorrection && (
        <ConfirmModal
          open={confirmFinalCorrection}
          title="Correct Final Starting Goalie"
          body={
            <>
              This game is final. Corrections can change goalie game logs and season stats. Continue
              editing the starting goalie for <strong>{game.away_team.code}</strong> vs{' '}
              <strong>{game.home_team.code}</strong>?
            </>
          }
          confirmLabel="Start Correction"
          confirmIcon="edit"
          intent="info"
          onConfirm={handleConfirmFinalCorrection}
          onCancel={() => setConfirmFinalCorrection(false)}
        />
      )}
    </>
  );
};

export default GameLineupsTab;
