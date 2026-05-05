import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/Card/Card';
import Select, { type SelectOption } from '@/components/Select/Select';
import useGames, { type GameRecord, type GameStatus } from '@/hooks/useGames';
import useSeasons from '@/hooks/useSeasons';
import GameListItem from '@/pages/admin/seasons/GameListItem';
import styles from '@/pages/admin/seasons/SeasonGamesTab.module.scss';

// ── Display helpers ───────────────────────────────────────────────────────────

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const formatTime = (hhmm: string): string => {
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return hhmm;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'} ET`;
};

const STATUS_INTENT: Record<GameStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  scheduled: 'info',
  in_progress: 'warning',
  final: 'success',
  postponed: 'warning',
  cancelled: 'danger',
};

const formatStatusLabel = (game: GameRecord): string => {
  const labels: Record<GameStatus, string> = {
    scheduled: 'Scheduled',
    in_progress: 'In Progress',
    final: 'Final',
    postponed: 'Postponed',
    cancelled: 'Cancelled',
  };
  if (game.status !== 'final') return labels[game.status];
  if (game.shootout || game.period_scores.some((ps) => ps.period === 'SO')) return 'Final/SO';
  if ((game.overtime_periods ?? 0) > 0 || game.period_scores.some((ps) => ps.period === 'OT'))
    return 'Final/OT';
  return 'Final';
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  teamId: string;
  leagueId: string;
}

const TeamGamesTab = ({ teamId, leagueId }: Props) => {
  const navigate = useNavigate();
  const { seasons, loading: seasonsLoading } = useSeasons(leagueId);
  const [seasonId, setSeasonId] = useState<string>('');

  // Auto-select the current season once the list loads (API returns current first).
  useEffect(() => {
    if (seasonId === '' && seasons.length > 0) {
      const current = seasons.find((s) => s.is_current);
      setSeasonId(current?.id ?? seasons[0].id);
    }
  }, [seasons, seasonId]);

  const { games, loading: gamesLoading } = useGames({
    teamId,
    seasonId: seasonId || undefined,
  });

  const seasonOptions = useMemo<SelectOption[]>(
    () => seasons.map((s) => ({ value: s.id, label: s.name })),
    [seasons],
  );

  const loading = seasonsLoading || gamesLoading;

  return (
    <Card
      title="Games"
      action={
        <div style={{ minWidth: '180px' }}>
          <Select
            value={seasonId}
            options={seasonOptions}
            onChange={setSeasonId}
            placeholder="Select season…"
            disabled={seasonsLoading}
          />
        </div>
      }
    >
      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : !seasonId ? (
        <p className={styles.empty}>Select a season to view games.</p>
      ) : games.length === 0 ? (
        <p className={styles.empty}>No games scheduled for this season.</p>
      ) : (
        <ul className={styles.list}>
          {games.map((game) => (
            <GameListItem
              key={game.id}
              href={`/admin/leagues/${leagueId}/seasons/${game.season_id}/games/${game.id}`}
              awayTeam={{
                logo: game.away_team.logo,
                code: game.away_team.code,
                primaryColor: game.away_team.primary_color,
                textColor: game.away_team.text_color,
              }}
              homeTeam={{
                logo: game.home_team.logo,
                code: game.home_team.code,
                primaryColor: game.home_team.primary_color,
                textColor: game.home_team.text_color,
              }}
              awayScore={game.period_scores.reduce((s, ps) => s + ps.away_goals, 0)}
              homeScore={game.period_scores.reduce((s, ps) => s + ps.home_goals, 0)}
              showScore={game.status === 'final' || game.status === 'in_progress'}
              isFinal={game.status === 'final'}
              statusLabel={formatStatusLabel(game)}
              statusIntent={STATUS_INTENT[game.status]}
              gameType={game.game_type}
              date={game.scheduled_at ? DATE_FMT.format(new Date(game.scheduled_at)) : undefined}
              time={game.scheduled_time ? formatTime(game.scheduled_time) : undefined}
              venue={game.venue ?? undefined}
              actions={[
                {
                  icon: 'open_in_new',
                  intent: 'neutral',
                  tooltip: 'View game',
                  onClick: () =>
                    navigate(
                      `/admin/leagues/${leagueId}/seasons/${game.season_id}/games/${game.id}`,
                    ),
                },
              ]}
            />
          ))}
        </ul>
      )}
    </Card>
  );
};

export default TeamGamesTab;
