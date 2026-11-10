import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import Chip from '@jerecocc/tracker-ui/components/Chip/Chip';
import { type ListItemAction } from '@jerecocc/tracker-ui/components/ListItem/ListItem';
import PlayerAvatar from '@jerecocc/tracker-ui/components/PlayerAvatar/PlayerAvatar';
import Tag from '@jerecocc/tracker-ui/components/Tag/Tag';
import TeamLogo from '@jerecocc/tracker-ui/components/TeamLogo/TeamLogo';
import { type PlayerRecord } from '@/hooks/useLeaguePlayers';
import { formatPlayerPosition, playerPositionTagIntent } from '@/lib/playerPosition';
import styles from './PlayerListCard.module.scss';

interface Props {
  player: PlayerRecord;
  href: string;
  /** Appended to the last name, e.g. the missing data indicator. */
  nameSuffix?: string;
  /** Shown under the position, e.g. the last season played. */
  note?: string;
  /** Extra tags beside the position, such as Rookie or the player's status. */
  tags?: ReactNode;
  actions?: (ListItemAction | null)[];
}

/**
 * A player in a list on phones, styled after the player details hero: the jersey number
 * and team across the top, then the photo beside the first name, a large last name and
 * the position.
 */
const PlayerListCard = ({ player, href, nameSuffix = '', note, tags, actions = [] }: Props) => {
  const fullName = `${player.first_name} ${player.last_name}`;
  const initials = `${player.first_name[0] ?? ''}${player.last_name[0] ?? ''}` || '?';
  const teamCode = (player.team_code ?? (player.team_name ?? '').slice(0, 3)) || 'TEAM';
  const position = formatPlayerPosition(player.position);
  const visibleActions = actions.filter((action): action is ListItemAction => action !== null);

  return (
    <li className={styles.card}>
      <div className={styles.header}>
        <Chip
          className={styles.jersey}
          primaryColor={player.primary_color}
          textColor={player.text_color}
        >
          {player.jersey_number ?? '-'}
        </Chip>
        <TeamLogo
          logo={player.team_logo}
          logoDark={player.team_logo_dark}
          logoLight={player.team_logo_light}
          code={teamCode}
          primaryColor={player.primary_color}
          textColor={player.text_color}
          size={24}
          shape="square"
        />
        <span
          className={styles.teamCode}
          title={player.team_name ?? undefined}
        >
          {player.team_code ?? 'No team'}
        </span>
        {visibleActions.length > 0 && (
          <div className={styles.actions}>
            {visibleActions.map((action) => (
              <Button
                key={action.icon}
                variant="outlined"
                intent={action.intent ?? 'neutral'}
                icon={action.icon}
                size="medium"
                tooltip={action.tooltip}
                aria-label={action.ariaLabel ?? action.tooltip}
                disabled={action.disabled}
                onClick={action.onClick}
              />
            ))}
          </div>
        )}
      </div>

      <div className={styles.body}>
        <PlayerAvatar
          photo={player.photo}
          initials={initials}
          primaryColor={player.primary_color}
          textColor={player.text_color}
          size={64}
        />
        <div className={styles.info}>
          <span className={styles.firstName}>{player.first_name}</span>
          <span className={styles.lastName}>
            {player.last_name}
            {nameSuffix}
          </span>
          {(position || tags) && (
            <span className={styles.tags}>
              {position && (
                <Tag
                  className={styles.positionTag}
                  label={position}
                  intent={playerPositionTagIntent(player.position)}
                  variant="outlined"
                />
              )}
              {tags}
            </span>
          )}
          {note && <span className={styles.note}>{note}</span>}
        </div>
      </div>

      {/* Covers the card so it opens the player; the actions sit above it. */}
      <Link
        to={href}
        className={styles.link}
        aria-label={fullName}
      />
    </li>
  );
};

export default PlayerListCard;
