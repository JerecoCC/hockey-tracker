import { useState, useEffect } from 'react';
import { useNavigate, useParams, useBlocker } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import Breadcrumbs from '../../../components/Breadcrumbs/Breadcrumbs';
import Button from '../../../components/Button/Button';
import Card from '../../../components/Card/Card';
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal';
import EntityHeader from '../../../components/EntityHeader/EntityHeader';
import Field from '../../../components/Field/Field';
import Icon from '../../../components/Icon/Icon';
import LogoUpload from '../../../components/LogoUpload/LogoUpload';
import RichTextEditor from '../../../components/RichTextEditor/RichTextEditor';
import Tabs from '../../../components/Tabs/Tabs';
import TitleRow from '../../../components/TitleRow/TitleRow';
import useTeamDetails from '../../../hooks/useTeamDetails';
import useLeagueGroups from '../../../hooks/useLeagueGroups';
import { type CreateTeamData } from '../../../hooks/useTeams';
import styles from './TeamDetails.module.scss';

interface FormValues {
  logo: File | string | null;
  name: string;
  code: string;
  city: string;
  home_arena: string;
  primary_color: string;
  text_color: string;
  description: string | null;
}

/** Treats empty-paragraph HTML from the rich-text editor as null. */
const normalizeDescription = (html: string | null | undefined): string | null => {
  if (!html || html === '<p></p>') return null;
  return html;
};

const TeamDetailsPage = () => {
  const navigate = useNavigate();
  const { id, leagueId } = useParams<{ id: string; leagueId?: string }>();
  const { team, loading, uploadLogo, updateTeam } = useTeamDetails(id);
  const { groups } = useLeagueGroups(team?.league_id ?? undefined);
  const [isEditing, setIsEditing] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      logo: null,
      name: '',
      code: '',
      city: '',
      home_arena: '',
      primary_color: '#334155',
      text_color: '#ffffff',
      description: null,
    },
  });

  useEffect(() => {
    if (isEditing && team) {
      reset({
        logo: team.logo ?? null,
        name: team.name,
        code: team.code,
        city: team.city ?? '',
        home_arena: team.home_arena ?? '',
        primary_color: team.primary_color,
        text_color: team.text_color,
        description: team.description ?? null,
      });
    }
  }, [isEditing, team, reset]);

  // Block in-app navigation any time edit mode is active
  const blocker = useBlocker(isEditing);

  const handleCancel = () => {
    setIsEditing(false);
    reset();
  };

  const onSubmit = handleSubmit(async (data) => {
    let logoUrl: string | null = typeof data.logo === 'string' ? data.logo : null;
    if (data.logo instanceof File) {
      const url = await uploadLogo(data.logo);
      if (!url) return;
      logoUrl = url;
    }
    const payload: Partial<CreateTeamData> = {
      logo: logoUrl,
      name: data.name,
      code: data.code,
      city: data.city || undefined,
      home_arena: data.home_arena || undefined,
      primary_color: data.primary_color,
      text_color: data.text_color,
      description: normalizeDescription(data.description) ?? undefined,
    };
    const ok = await updateTeam(team!.id, payload);
    if (ok) setIsEditing(false);
  });

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
        disabled={isEditing}
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
                  isEditing={isEditing}
                  onEdit={() => setIsEditing(true)}
                  swatches={[
                    { label: 'Primary', color: team.primary_color },
                    { label: 'Text', color: team.text_color },
                  ]}
                  logoSlot={
                    <LogoUpload
                      control={control}
                      name="logo"
                      label="Team Logo"
                      disabled={isSubmitting}
                    />
                  }
                  nameSlot={
                    <>
                      <Field
                        label="Name"
                        required
                        control={control}
                        name="name"
                        rules={{ required: true }}
                        placeholder="e.g. Toronto Maple Leafs"
                        disabled={isSubmitting}
                      />
                      <Field
                        label="Code"
                        required
                        control={control}
                        name="code"
                        rules={{ required: true }}
                        transform={(v) => v.toUpperCase()}
                        placeholder="e.g. TOR"
                        disabled={isSubmitting}
                      />
                    </>
                  }
                  rightSlot={
                    <>
                      <div className={styles.editHeaderActions}>
                        <Button
                          type="button"
                          variant="outlined"
                          intent="neutral"
                          disabled={isSubmitting}
                          onClick={handleCancel}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          form="team-edit-form"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? 'Saving…' : 'Save Changes'}
                        </Button>
                      </div>
                      <div className={styles.editHeaderFields}>
                        <Field
                          type="color"
                          label="Primary Color"
                          control={control}
                          name="primary_color"
                        />
                        <Field
                          type="color"
                          label="Text Color"
                          control={control}
                          name="text_color"
                        />
                      </div>
                    </>
                  }
                />

                {isEditing ? (
                  /* ── Inline edit form ─────────────────────────────────── */
                  <form
                    id="team-edit-form"
                    className={styles.editForm}
                    onSubmit={onSubmit}
                  >
                    <div className={styles.infoGrid}>
                      {/* League — disabled (read-only reference) */}
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

                      {/* Group — disabled (read-only reference) */}
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

                      {/* City | Home Arena */}
                      <Field
                        label="City"
                        control={control}
                        name="city"
                        placeholder="e.g. Toronto"
                        disabled={isSubmitting}
                      />
                      <Field
                        label="Home Arena"
                        control={control}
                        name="home_arena"
                        placeholder="e.g. Scotiabank Arena"
                        disabled={isSubmitting}
                      />

                      {/* Description — full width */}
                      <div className={styles.infoItemFull}>
                        <span className={styles.infoLabel}>Description</span>
                        <Controller
                          control={control}
                          name="description"
                          render={({ field }) => (
                            <RichTextEditor
                              content={field.value ?? ''}
                              onChange={field.onChange}
                              autoFocus={false}
                            />
                          )}
                        />
                      </div>
                    </div>
                  </form>
                ) : (
                  /* ── Read-only info grid ──────────────── */
                  <div className={styles.infoGrid}>
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
                    {team.city && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>City</span>
                        <span className={styles.infoValue}>{team.city}</span>
                      </div>
                    )}
                    {team.home_arena && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Home Arena</span>
                        <span className={styles.infoValue}>{team.home_arena}</span>
                      </div>
                    )}
                    <div className={`${styles.infoItem} ${styles.infoItemFull}`}>
                      <span className={styles.infoLabel}>Description</span>
                      {normalizeDescription(team.description) ? (
                        <div
                          className={styles.infoValue}
                          dangerouslySetInnerHTML={{ __html: team.description! }}
                        />
                      ) : (
                        <span className={styles.infoValueMuted}>No description</span>
                      )}
                    </div>
                  </div>
                )}
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

      {/* Navigation guard modal */}
      <ConfirmModal
        open={blocker.state === 'blocked'}
        title="Unsaved Changes"
        body="You have unsaved changes. Are you sure you want to leave?"
        confirmLabel="Leave without saving"
        variant="danger"
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
    </>
  );
};

export default TeamDetailsPage;
