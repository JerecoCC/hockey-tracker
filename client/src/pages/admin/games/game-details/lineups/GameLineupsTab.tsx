import React, { useState } from 'react';
import Accordion from '@/components/Accordion/Accordion';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import ListItem from '@/components/ListItem/ListItem';
import useTeamPlayers from '@/hooks/useTeamPlayers';
import useGameLineup, { type LineupEntry } from '@/hooks/useGameLineup';
import { type GameRosterEntry } from '@/hooks/useGameRoster';
import { type GameRecord } from '@/hooks/useGames';
import { POSITION_LABEL } from '../constants';
import LineupRosterModal from './LineupRosterModal';
import LineupCreatePlayersModal from './LineupCreatePlayersModal';
import SetLineupModal from './SetLineupModal';
import RemoveFromLineupModal from './RemoveFromLineupModal';
import styles from '../GameDetailsPage.module.scss';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  game: GameRecord;
  isFinal: boolean;
  leagueId: string;
  seasonId: string | undefined;
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
  isFinal,
  leagueId,
  seasonId,
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
  const [lineupSetTeam, setLineupSetTeam] = useState<'away' | 'home' | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ entry: GameRosterEntry } | null>(null);
  const [removingFromRoster, setRemovingFromRoster] = useState(false);

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
      .filter((e) => e.team_id === game.away_team.id && !e.inherited)
      .map((e) => [e.player_id, e]),
  );
  const homeLineupMap = new Map(
    lineup
      .filter((e) => e.team_id === game.home_team.id && !e.inherited)
      .map((e) => [e.player_id, e]),
  );
  const awayInheritedLineupMap = new Map(
    lineup
      .filter((e) => e.team_id === game.away_team.id && !!e.inherited)
      .map((e) => [e.player_id, e]),
  );
  const homeInheritedLineupMap = new Map(
    lineup
      .filter((e) => e.team_id === game.home_team.id && !!e.inherited)
      .map((e) => [e.player_id, e]),
  );

  const handleConfirmRemove = async () => {
    if (!confirmRemove) return;
    setRemovingFromRoster(true);
    await removeFromRoster(confirmRemove.entry.id);
    setRemovingFromRoster(false);
    setConfirmRemove(null);
  };

  const renderTeamAccordion = (
    side: 'away' | 'home',
    teamName: string,
    teamCode: string,
    teamLogo: string | null | undefined,
    primaryColor: string,
    textColor: string,
    rosterEntries: GameRosterEntry[],
    lineupMap: typeof awayLineupMap,
    inheritedLineupMap: typeof awayInheritedLineupMap,
    inheritedEntries: GameRosterEntry[],
  ) => (
    <Accordion
      variant="static"
      label={
        <span className={styles.accordionTeamLabel}>
          {teamLogo ? (
            <img
              src={teamLogo}
              alt={teamCode}
              className={styles.accordionTeamLogo}
            />
          ) : (
            <span className={styles.accordionTeamLogoPlaceholder}>{teamCode.slice(0, 3)}</span>
          )}
          {teamName}
          <span className={styles.accordionTeamCount}>({rosterEntries.length}/23)</span>
        </span>
      }
      hoverActions={
        isFinal
          ? []
          : [
              ...(inheritedEntries.length > 0 && rosterEntries.length === 0
                ? [
                    {
                      icon: 'clone',
                      tooltip: 'Auto-fill from Last Game',
                      intent: 'accent' as const,
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
              ...(rosterEntries.length > 0
                ? [
                    {
                      icon: 'set_lineup',
                      tooltip: 'Set Starting Lineup',
                      intent: 'info' as const,
                      onClick: () => setLineupSetTeam(side),
                    },
                  ]
                : []),
              ...(rosterEntries.length < 23
                ? [
                    {
                      icon: 'group_add',
                      tooltip: 'Add from Season Roster',
                      intent: 'neutral' as const,
                      onClick: () => setLineupAddTeam(side),
                    },
                    {
                      icon: 'person_edit',
                      tooltip: 'Create Player',
                      intent: 'neutral' as const,
                      onClick: () => setLineupCreateTeam(side),
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
            const isStarter = lineupMap.has(e.player_id);
            const isInheritedStarter = !isStarter && inheritedLineupMap.has(e.player_id);
            const positionPart = e.position
              ? (POSITION_LABEL[e.position] ?? e.position)
              : undefined;
            return (
              <ListItem
                key={e.id}
                image={e.photo}
                image_shape="circle"
                primaryColor={primaryColor}
                textColor={textColor}
                jerseyNumber={e.jersey_number ?? null}
                eyebrow={positionPart}
                name={`${e.last_name}, ${e.first_name}`}
                placeholder={`${e.first_name[0]}${e.last_name[0]}`}
                href={`/admin/leagues/${leagueId}/teams/${e.team_id}/players/${e.player_id}`}
                rightContent={
                  isStarter
                    ? { type: 'tag', label: 'Starter', intent: 'accent' }
                    : isInheritedStarter
                      ? { type: 'tag', label: 'Last Game', intent: 'neutral' }
                      : undefined
                }
                actions={
                  isFinal
                    ? []
                    : [
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
              <ul className={styles.lineupPlayerList}>{skaters.map(renderPlayer)}</ul>
              {goalies.length > 0 && (
                <>
                  <div className={styles.lineupDivider} />
                  <ul className={styles.lineupPlayerList}>{goalies.map(renderPlayer)}</ul>
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
        <Card title="Lineups">
          <div className={styles.lineupGrid}>
            {renderTeamAccordion(
              'away',
              game.away_team.name,
              game.away_team.code,
              game.away_team.logo,
              game.away_team.primary_color,
              game.away_team.text_color,
              awayRoster,
              awayLineupMap,
              awayInheritedLineupMap,
              awayRosterInherited,
            )}
            {renderTeamAccordion(
              'home',
              game.home_team.name,
              game.home_team.code,
              game.home_team.logo,
              game.home_team.primary_color,
              game.home_team.text_color,
              homeRoster,
              homeLineupMap,
              homeInheritedLineupMap,
              homeRosterInherited,
            )}
          </div>
        </Card>
      </div>

      {/* ── Add from Roster ── */}
      {lineupAddTeam !== null && (
        <LineupRosterModal
          open={lineupAddTeam !== null}
          onClose={() => setLineupAddTeam(null)}
          teamId={lineupAddTeam === 'away' ? game.away_team.id : game.home_team.id}
          seasonId={seasonId!}
          teamName={lineupAddTeam === 'away' ? game.away_team.name : game.home_team.name}
          existingPlayerIds={
            new Set((lineupAddTeam === 'away' ? awayRoster : homeRoster).map((e) => e.player_id))
          }
          addToGameRoster={(playerIds) =>
            addToRoster(lineupAddTeam === 'away' ? game.away_team.id : game.home_team.id, playerIds)
          }
        />
      )}

      {/* ── Create Player ── */}
      {lineupCreateTeam !== null && (
        <LineupCreatePlayersModal
          open={lineupCreateTeam !== null}
          onClose={() => setLineupCreateTeam(null)}
          teamId={lineupCreateTeam === 'away' ? game.away_team.id : game.home_team.id}
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

      {/* ── Set Starting Lineup ── */}
      {lineupSetTeam !== null &&
        (() => {
          const rosterForSide = (lineupSetTeam === 'away' ? awayRoster : homeRoster).map((e) => ({
            ...e,
            id: e.player_id,
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
            />
          );
        })()}

      {/* ── Remove from Lineup ── */}
      <RemoveFromLineupModal
        entry={confirmRemove?.entry ?? null}
        busy={removingFromRoster}
        onConfirm={handleConfirmRemove}
        onCancel={() => setConfirmRemove(null)}
      />
    </>
  );
};

export default GameLineupsTab;
