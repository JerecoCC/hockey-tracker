import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '../../../components/Breadcrumbs/Breadcrumbs';
import Button from '../../../components/Button/Button';
import DescriptionEditor from '../../../components/DescriptionEditor/DescriptionEditor';
import EntityHeader from '../../../components/EntityHeader/EntityHeader';
import Icon from '../../../components/Icon/Icon';
import Tabs from '../../../components/Tabs/Tabs';
import TeamFormModal from './TeamFormModal';
import useTeamDetails from '../../../hooks/useTeamDetails';
import useLeagueGroups from '../../../hooks/useLeagueGroups';
import Card from '../../../components/Card/Card';
import TitleRow from '../../../components/TitleRow/TitleRow';
import styles from './TeamDetails.module.scss';

const TeamDetailsPage = () => {
  const navigate = useNavigate();
  const { id, leagueId } = useParams<{ id: string; leagueId?: string }>();
  const { team, loading, busy, uploadLogo, updateTeam } = useTeamDetails(id);
  const { groups } = useLeagueGroups(team?.league_id ?? undefined);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const fromLeague = Boolean(leagueId);

  const breadcrumbItems = fromLeague
    ? [
        { label: 'Leagues', path: '/admin/leagues' },
        { label: team?.league_name ?? '…', path: `/admin/leagues/${leagueId}` },
        { label: team?.name ?? '…' },
      ]
    : [{ label: 'Teams', path: '/admin/teams' }, { label: team?.name ?? '…' }];

  const backPath = fromLeague ? `/admin/leagues/${leagueId}` : '/admin/teams';
  const backTooltip = fromLeague ? 'Back to League Details' : 'Back to Teams';

  if (loading) {
    return (
      <div className={styles.loaderWrapper}>
        <span className={styles.spinner} />
        <p className={styles.loaderText}>Loading team…</p>
      </div>
    );
  }

  if (!team) {
    return <p className={styles.loaderText}>Team not found.</p>;
  }

  const teamGroupLabels = groups
    .filter((g) => g.teams.some((t) => t.id === team.id))
    .map((g) => {
      if (g.parent_id) {
        const parent = groups.find((p) => p.id === g.parent_id);
        return parent ? `${parent.name} – ${g.name}` : g.name;
      }
      return g.name;
    });

  const isBusy = busy === team.id;

  return (
    <>
      <TitleRow
        left={
          <Button
            variant="outlined"
            intent="neutral"
            icon="arrow_back"
            tooltip={backTooltip}
            onClick={() => navigate(backPath, fromLeague ? { state: { activeTab: 1 } } : undefined)}
          />
        }
        right={<Breadcrumbs items={breadcrumbItems} />}
      />

      <Tabs
        tabs={[
          {
            label: 'Info',
            content: (
              <Card>
                <EntityHeader
                  logo={team.logo}
                  name={team.name}
                  code={team.code}
                  primaryColor={team.primary_color}
                  textColor={team.text_color}
                  isBusy={isBusy}
                  onLogoChange={async (file) => {
                    const url = await uploadLogo(file);
                    if (url) await updateTeam(team.id, { logo: url });
                  }}
                  onEdit={() => setEditModalOpen(true)}
                  editTooltip="Edit team"
                  logoEditTooltip="Edit team logo"
                  swatches={[
                    { label: 'Primary', color: team.primary_color },
                    { label: 'Text', color: team.text_color },
                  ]}
                />

                {/* ── Info grid ──────────────────────────── */}
                <div className={styles.infoGrid}>
                  {/* League */}
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>League</span>
                    {team.league_id ? (
                      <div className={styles.leagueBadge}>
                        {team.league_logo ? (
                          <img
                            src={team.league_logo}
                            alt={team.league_name ?? ''}
                            className={styles.leagueLogo}
                          />
                        ) : (
                          <span className={styles.leagueLogoPlaceholder}>
                            {team.league_code?.slice(0, 3)}
                          </span>
                        )}
                        <span className={styles.infoValue}>{team.league_name}</span>
                      </div>
                    ) : (
                      <span className={styles.infoValueMuted}>Unassigned</span>
                    )}
                  </div>

                  {/* Group */}
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Group</span>
                    {teamGroupLabels.length > 0 ? (
                      teamGroupLabels.map((label, i) => (
                        <span
                          key={i}
                          className={styles.infoValue}
                        >
                          {label}
                        </span>
                      ))
                    ) : (
                      <span className={styles.infoValueMuted}>No groups</span>
                    )}
                  </div>

                  {/* Location */}
                  {team.location && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Location</span>
                      <span className={styles.infoValue}>
                        <Icon
                          name="location_on"
                          size="0.9em"
                        />
                        {team.location}
                      </span>
                    </div>
                  )}

                  {/* City */}
                  {team.city && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>City</span>
                      <span className={styles.infoValue}>{team.city}</span>
                    </div>
                  )}

                  {/* Home Arena */}
                  {team.home_arena && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Home Arena</span>
                      <span className={styles.infoValue}>{team.home_arena}</span>
                    </div>
                  )}

                  {/* Description – full width */}
                  <div className={`${styles.infoItem} ${styles.infoItemFull}`}>
                    <span className={styles.infoLabel}>Description</span>
                    <DescriptionEditor
                      description={team.description}
                      onSave={(html) => updateTeam(team.id, { description: html })}
                    />
                  </div>
                </div>
              </Card>
            ),
          },
          {
            label: 'Games',
            content: (
              <Card>
                <p className={styles.tabPlaceholder}>Games coming soon.</p>
              </Card>
            ),
          },
          {
            label: 'Roster',
            content: (
              <Card>
                <p className={styles.tabPlaceholder}>Roster coming soon.</p>
              </Card>
            ),
          },
          {
            label: 'Prospects',
            content: (
              <Card>
                <p className={styles.tabPlaceholder}>Prospects coming soon.</p>
              </Card>
            ),
          },
        ]}
      />

      <TeamFormModal
        open={editModalOpen}
        editTarget={team}
        lockedLeagueId={team.league_id ?? undefined}
        onClose={() => setEditModalOpen(false)}
        addTeam={async () => false}
        updateTeam={updateTeam}
        uploadLogo={uploadLogo}
      />
    </>
  );
};

export default TeamDetailsPage;
