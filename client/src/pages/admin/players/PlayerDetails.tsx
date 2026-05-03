import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import Breadcrumbs from '@/components/Breadcrumbs/Breadcrumbs';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import Table, { type Column } from '@/components/Table/Table';
import Tabs from '@/components/Tabs/Tabs';
import TitleRow from '@/components/TitleRow/TitleRow';
import usePlayerDetails, { type PlayerCareerStatRecord } from '@/hooks/usePlayerDetails';
import useTeamDetails from '@/hooks/useTeamDetails';
import useSeasons from '@/hooks/useSeasons';
import useTeams from '@/hooks/useTeams';
import {
  usePlayerTradeHistory,
  useStintActions,
  useJerseyHistory,
  type PlayerStintRecord,
  type TeamPlayerRecord,
} from '@/hooks/useTeamPlayers';
import { type CreatePlayerData } from '@/hooks/useLeaguePlayers';
import useTabState from '@/hooks/useTabState';
import TeamPlayerEditModal from '../teams/TeamPlayerEditModal';
import StintEditModal from './StintEditModal';
import ChangeJerseyModal from './ChangeJerseyModal';
import styles from './PlayerDetails.module.scss';

const API = import.meta.env.VITE_API_URL || '/api';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const POSITION_LABELS: Record<string, string> = {
  C: 'Center',
  LW: 'Left Wing',
  RW: 'Right Wing',
  D: 'Defense',
  G: 'Goalie',
};

const formatHeight = (cm: number | null) => {
  if (!cm) return null;
  const totalIn = Math.round(cm / 2.54);
  return `${Math.floor(totalIn / 12)}'${totalIn % 12}" (${cm} cm)`;
};

const formatDate = (iso: string | null) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// ── Career stats table columns ──────────────────────────────────────────────
const statColumns: Column<PlayerCareerStatRecord>[] = [
  {
    type: 'logo',
    header: 'Team',
    getLogo: (r) => r.team_logo,
    getName: (r) => r.team_name ?? '—',
    getCode: (r) => r.team_name?.slice(0, 3).toUpperCase() ?? '?',
  },
  { header: 'Season', key: 'season_name' },
  { header: '#', key: 'jersey_number', align: 'center' },
  { header: 'GP', key: 'gp', align: 'center' },
  { header: 'G', key: 'goals', align: 'center' },
  { header: 'A', key: 'assists', align: 'center' },
  { header: 'PTS', key: 'points', align: 'center' },
];

// ── Page ────────────────────────────────────────────────────────────────────
const PlayerDetailsPage = () => {
  const navigate = useNavigate();
  const { id, leagueId, teamId } = useParams<{ id: string; leagueId: string; teamId: string }>();
  const { player, stats, loading } = usePlayerDetails(id);
  const { team: teamDetails } = useTeamDetails(teamId);
  const { stints } = usePlayerTradeHistory(id ?? null);
  const { byStint: jerseyHistoryByStint } = useJerseyHistory(id ?? null);
  const { createStint, updateStint, changeJerseyNumber, uploadStintPhoto } = useStintActions(
    id ?? null,
  );
  const { teams } = useTeams();
  const { seasons } = useSeasons();
  const queryClient = useQueryClient();
  const [activeTab, handleTabChange] = useTabState('tab:player-details');
  const [editPlayerOpen, setEditPlayerOpen] = useState(false);
  const [editingStint, setEditingStint] = useState<PlayerStintRecord | null>(null);
  const [creatingStint, setCreatingStint] = useState(false);
  const [changingJerseyStint, setChangingJerseyStint] = useState<PlayerStintRecord | null>(null);

  const updatePlayer = async (
    playerId: string,
    payload: Partial<CreatePlayerData>,
  ): Promise<boolean> => {
    try {
      await axios.patch(`${API}/admin/players/${playerId}`, payload, { headers: authHeaders() });
      toast.success('Player updated!');
      await queryClient.invalidateQueries({ queryKey: ['player', playerId] });
      await queryClient.invalidateQueries({ queryKey: ['game-roster'] });
      return true;
    } catch {
      toast.error('Failed to update player');
      return false;
    }
  };

  // Wraps updateStint so TeamPlayerEditModal can save jersey_number + photo on the latest stint.
  const updatePlayerTeam = async (
    _playerId: string,
    _teamId: string,
    _seasonId: string,
    payload: { jersey_number?: number | null; photo?: string | null },
  ): Promise<boolean> => {
    const stint = stints[0];
    if (!stint) return false;
    return updateStint(stint.id, payload);
  };

  if (loading) {
    return (
      <div className={styles.loaderWrapper}>
        <span className={styles.spinner} />
        <p className={styles.loaderText}>Loading player…</p>
      </div>
    );
  }

  if (!player) return <p className={styles.loaderText}>Player not found.</p>;

  const fullName = `${player.first_name} ${player.last_name}`;
  const initials = `${player.first_name[0]}${player.last_name[0]}`;
  const latestStint = stints[0];
  const jerseyNumber = latestStint?.jersey_number ?? null;
  // Use the first stint (active) photo; if that's missing, fall back to the most-recent
  // historical stint that does have a photo; then fall back to the global player photo.
  const photo = stints.find((s) => s.photo)?.photo ?? player.photo;
  const avatarBg = latestStint?.primary_color ?? undefined;
  const avatarColor = latestStint?.text_color ?? undefined;
  const positionLabel = player.position
    ? (POSITION_LABELS[player.position] ?? player.position)
    : null;

  const playerEditTarget: TeamPlayerRecord = {
    ...player,
    photo,
    jersey_number: latestStint?.jersey_number ?? null,
    team_name: latestStint?.team_name ?? null,
    primary_color: latestStint?.primary_color ?? null,
    text_color: latestStint?.text_color ?? null,
  };

  return (
    <>
      <TitleRow
        left={
          <Button
            variant="outlined"
            intent="neutral"
            icon="arrow_back"
            tooltip={`Back to ${teamDetails?.name ?? 'Team'}`}
            onClick={() => navigate(`/admin/leagues/${leagueId}/teams/${teamId}`)}
          />
        }
        right={
          <Breadcrumbs
            items={[
              { label: teamDetails?.league_name ?? '…', path: `/admin/leagues/${leagueId}` },
              {
                label: latestStint?.team_name ?? teamDetails?.name ?? '…',
                path: `/admin/leagues/${leagueId}/teams/${teamId}`,
              },
              { label: fullName },
            ]}
          />
        }
      />

      {/* Hero card */}
      <Card>
        <div className={styles.hero}>
          <div className={styles.avatarWrapper}>
            {photo ? (
              <img
                src={photo}
                alt={fullName}
                className={styles.avatar}
              />
            ) : (
              <span
                className={styles.avatarInitials}
                style={{ background: avatarBg, color: avatarColor }}
              >
                {initials}
              </span>
            )}
          </div>
          <div className={styles.heroInfo}>
            <h2 className={styles.heroName}>{fullName}</h2>
            <div className={styles.heroMeta}>
              {positionLabel && <span>{positionLabel}</span>}
              {jerseyNumber != null && <span>#{jerseyNumber}</span>}
              {latestStint?.team_name && <span>{latestStint.team_name}</span>}
            </div>
          </div>
          <span
            className={`${styles.statusBadge} ${player.is_active ? styles.statusActive : styles.statusInactive}`}
          >
            {player.is_active ? 'Active' : 'Inactive'}
          </span>
          <Button
            variant="outlined"
            intent="neutral"
            icon="edit"
            size="sm"
            tooltip="Edit player"
            onClick={() => setEditPlayerOpen(true)}
          />
        </div>
      </Card>

      <div className={styles.tabsWrapper}>
        <Tabs
          activeIndex={activeTab}
          onTabChange={handleTabChange}
          tabs={[
            {
              label: 'Info',
              content: (
                <Card>
                  <div className={styles.infoGrid}>
                    <InfoCell
                      label="Date of Birth"
                      value={formatDate(player.date_of_birth)}
                    />
                    <InfoCell
                      label="Birth City"
                      value={player.birth_city}
                    />
                    <InfoCell
                      label="Birth Country"
                      value={player.birth_country}
                    />
                    <InfoCell
                      label="Nationality"
                      value={player.nationality}
                    />
                    <InfoCell
                      label="Height"
                      value={formatHeight(player.height_cm)}
                    />
                    <InfoCell
                      label="Weight"
                      value={player.weight_lbs ? `${player.weight_lbs} lbs` : null}
                    />
                    <InfoCell
                      label="Position"
                      value={positionLabel}
                    />
                    <InfoCell
                      label="Shoots"
                      value={
                        player.shoots === 'L' ? 'Left' : player.shoots === 'R' ? 'Right' : null
                      }
                    />
                  </div>
                </Card>
              ),
            },
            {
              label: 'Career Stats',
              content: (
                <Card title="Career Statistics">
                  <Table
                    columns={statColumns}
                    data={stats}
                    rowKey={(r) => r.season_id}
                    emptyMessage="No stats recorded yet."
                  />
                </Card>
              ),
            },
            {
              label: 'Team History',
              content: (
                <Card
                  title="Team History"
                  action={
                    <Button
                      variant="outlined"
                      intent="neutral"
                      icon="add"
                      size="sm"
                      onClick={() => setCreatingStint(true)}
                    >
                      Record Stint
                    </Button>
                  }
                >
                  {stints.length === 0 ? (
                    <p className={styles.placeholder}>No team history yet.</p>
                  ) : (
                    <ul className={styles.stintList}>
                      {stints.map((s) => (
                        <li
                          key={s.id}
                          className={styles.stintItem}
                        >
                          {s.team_logo ? (
                            <img
                              src={s.team_logo}
                              alt={s.team_name ?? ''}
                              className={styles.stintLogo}
                            />
                          ) : (
                            <span
                              className={styles.stintLogoPlaceholder}
                              style={{
                                background: s.primary_color ?? undefined,
                                color: s.text_color ?? undefined,
                              }}
                            >
                              {(s.team_code ?? s.team_name ?? '?').slice(0, 3)}
                            </span>
                          )}
                          <div className={styles.stintInfo}>
                            <span className={styles.stintTeam}>{s.team_name ?? '—'}</span>
                            <span className={styles.stintMeta}>
                              {s.jersey_number != null ? `#${s.jersey_number} · ` : ''}
                              {s.start_date ? s.start_date.slice(0, 10) : '?'} –{' '}
                              {s.end_date ? s.end_date.slice(0, 10) : 'Present'}
                            </span>
                          </div>
                          {!s.end_date && (
                            <Button
                              variant="outlined"
                              intent="neutral"
                              icon="jersey"
                              size="sm"
                              tooltip="Change jersey number"
                              onClick={() => setChangingJerseyStint(s)}
                            />
                          )}
                          <Button
                            variant="outlined"
                            intent="neutral"
                            icon="edit"
                            size="sm"
                            tooltip="Edit stint"
                            onClick={() => setEditingStint(s)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              ),
            },
          ]}
        />
      </div>

      <TeamPlayerEditModal
        open={editPlayerOpen}
        editTarget={playerEditTarget}
        teamId={latestStint?.team_id ?? ''}
        seasonId={latestStint?.season_id ?? null}
        onClose={() => setEditPlayerOpen(false)}
        updatePlayer={updatePlayer}
        updatePlayerTeam={updatePlayerTeam}
        uploadPlayerPhoto={uploadStintPhoto}
      />

      <ChangeJerseyModal
        open={!!changingJerseyStint}
        stint={changingJerseyStint}
        history={jerseyHistoryByStint[changingJerseyStint?.id ?? ''] ?? []}
        onClose={() => setChangingJerseyStint(null)}
        changeJerseyNumber={changeJerseyNumber}
      />

      <StintEditModal
        open={creatingStint || !!editingStint}
        stint={editingStint}
        teams={teams}
        seasons={seasons}
        onClose={() => {
          setEditingStint(null);
          setCreatingStint(false);
        }}
        createStint={createStint}
        updateStint={updateStint}
        uploadStintPhoto={uploadStintPhoto}
      />
    </>
  );
};

// ── Helpers ──────────────────────────────────────────────────────────────────
// ── Helper: label/value cell ────────────────────────────────────────────────
const InfoCell = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className={styles.infoCell}>
    <span className={styles.infoCellLabel}>{label}</span>
    {value ? (
      <span className={styles.infoCellValue}>{value}</span>
    ) : (
      <span className={styles.infoCellMuted}>—</span>
    )}
  </div>
);

export default PlayerDetailsPage;
