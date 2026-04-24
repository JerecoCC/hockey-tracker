import { CSSProperties } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { type IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowLeft,
  faArrowRotateRight,
  faChartLine,
  faArrowUpRightFromSquare,
  faCheck,
  faCircleMinus,
  faClipboardList,
  faClock,
  faEllipsisVertical,
  faFlag,
  faGauge,
  faCalendarDays,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faCircleUser,
  faClockRotateLeft,
  faEnvelope,
  faEye,
  faEyeSlash,
  faFolderPlus,
  faHockeyPuck,
  faLocationDot,
  faMagnifyingGlass,
  faPen,
  faPeopleGroup,
  faPlay,
  faPlus,
  faRightFromBracket,
  faShield,
  faSort,
  faSortDown,
  faSortUp,
  faStar,
  faTrash,
  faTrophy,
  faUserGear,
  faUserMinus,
  faUserPen,
  faUserPlus,
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
  calendar: faCalendarDays,
  play_arrow: faPlay,
  folder_plus: faFolderPlus,
  check: faCheck,
  close: faXmark,
  delete: faTrash,
  edit: faPen,
  group_add: faUserPlus,
  person_add: faUserPlus,
  person_edit: faUserPen,
  set_lineup: faClipboardList,
  history: faClockRotateLeft,
  manage_accounts: faUserGear,
  person_remove: faUserMinus,
  remove_circle_outline: faCircleMinus,
  restart_alt: faArrowRotateRight,
  search: faMagnifyingGlass,

  // auth
  account_circle: faCircleUser,
  mail: faEnvelope,
  visibility: faEye,
  visibility_off: faEyeSlash,
  location_on: faLocationDot,
  open_in_new: faArrowUpRightFromSquare,

  // page header
  apps: faGauge,
  logout: faRightFromBracket,

  // stats
  query_stats: faChartLine,

  // decorative
  sports_hockey: faHockeyPuck,
  celebration: faStar,
  stars: faStar,
  flag: faFlag,
  more_vert: faEllipsisVertical,
  more_time: faClock,
};

interface IconProps {
  name: string;
  size?: string;
  className?: string;
  style?: CSSProperties;
}

const Icon = (props: IconProps) => {
  const { name, size, className = '', style = {} } = props;
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
