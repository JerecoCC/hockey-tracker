import { CSSProperties } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { type IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowLeft,
  faCalendarDays,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faCircleUser,
  faEnvelope,
  faHockeyPuck,
  faPen,
  faPeopleGroup,
  faPlus,
  faShield,
  faSort,
  faSortDown,
  faSortUp,
  faStar,
  faTrash,
  faTrophy,
  faUserGear,
  faUserMinus,
  faUsers,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';

/**
 * Thin wrapper around Font Awesome icons.
 * Usage: <Icon name="sports_hockey" />
 *
 * The `name` prop accepts the original Material Icons name; it is mapped
 * internally to the corresponding Font Awesome icon.
 *
 * Optional props:
 *   size      – CSS font-size string, e.g. "1.25rem" (sets fontSize + height)
 *   style     – extra inline styles
 *   className – extra class names
 */

const ICON_MAP: Record<string, IconDefinition> = {
  // navigation / admin
  arrow_back: faArrowLeft,
  chevron_left: faChevronLeft,
  chevron_right: faChevronRight,
  expand_more: faChevronDown,
  shield: faShield,

  // nav items
  calendar_month: faCalendarDays,
  calendar_today: faCalendarDays,
  groups: faPeopleGroup,
  group: faUsers,
  emoji_events: faTrophy,

  // sort
  sort: faSort,
  sort_asc: faSortUp,
  sort_desc: faSortDown,

  // actions
  add: faPlus,
  close: faXmark,
  delete: faTrash,
  edit: faPen,
  manage_accounts: faUserGear,
  person_remove: faUserMinus,

  // auth
  account_circle: faCircleUser,
  mail: faEnvelope,

  // decorative
  sports_hockey: faHockeyPuck,
  celebration: faStar,
};

interface IconProps {
  name: string;
  size?: string;
  className?: string;
  style?: CSSProperties;
}

const Icon = ({ name, size, className = '', style = {} }: IconProps) => {
  const icon = ICON_MAP[name];
  if (!icon) return null;

  const inlineStyle: CSSProperties = size ? { fontSize: size, height: size, ...style } : style;

  return (
    <FontAwesomeIcon
      icon={icon}
      className={className || undefined}
      style={
        Object.keys(inlineStyle).length
          ? (inlineStyle as CSSProperties & Record<`--fa-font-${string}`, string>)
          : undefined
      }
      aria-hidden
    />
  );
};

export default Icon;
