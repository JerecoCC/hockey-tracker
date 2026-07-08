import { CSSProperties } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { type IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowLeft,
  faArrowDown,
  faArrowRight,
  faArrowRotateLeft,
  faArrowRotateRight,
  faArrowUp,
  faBackwardFast,
  faBullseye,
  faChartLine,
  faArrowUpRightFromSquare,
  faBars,
  faCheck,
  faDownload,
  faFloppyDisk,
  faCircleCheck,
  faCircleInfo,
  faCircleMinus,
  faCircleXmark,
  faClone,
  faSquare,
  faSquareCheck,
  faClipboardList,
  faClock,
  faEllipsisVertical,
  faFilter,
  faFlag,
  faGauge,
  faGear,
  faHeart,
  faCalendarDays,
  faCalendarXmark,
  faCaretDown,
  faCaretUp,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faCircleUser,
  faClockRotateLeft,
  faEnvelope,
  faEye,
  faEyeSlash,
  faFolderPlus,
  faForwardFast,
  faGripVertical,
  faHashtag,
  faHockeyPuck,
  faHourglassHalf,
  faImage,
  faLayerGroup,
  faList,
  faLocationDot,
  faMagnifyingGlass,
  faMoon,
  faPen,
  faPeopleGroup,
  faPlay,
  faPlus,
  faRankingStar,
  faRightFromBracket,
  faRightLeft,
  faShield,
  faSort,
  faSortDown,
  faSortUp,
  faStar,
  faSun,
  faTableCells,
  faTrash,
  faTrophy,
  faTriangleExclamation,
  faUserGear,
  faUserMinus,
  faUserPen,
  faUserPlus,
  faUserSlash,
  faUsers,
  faXmark,
  faMagnifyingGlassChart,
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
  arrow_downward: faArrowDown,
  arrow_forward: faArrowRight,
  arrow_upward: faArrowUp,
  caret_down: faCaretDown,
  caret_up: faCaretUp,
  chevron_left: faChevronLeft,
  chevron_right: faChevronRight,
  first_page: faBackwardFast,
  last_page: faForwardFast,
  expand_more: faChevronDown,
  north: faArrowUp,
  south: faArrowDown,
  menu: faBars,
  shield: faShield,
  settings: faGear,

  // info
  info: faCircleInfo,

  // nav items
  calendar_month: faCalendarDays,
  calendar_today: faCalendarDays,
  groups: faPeopleGroup,
  group: faUsers,
  emoji_events: faTrophy,
  trophy: faTrophy,
  leaderboard: faTableCells,

  // sort
  sort: faSort,
  sort_asc: faSortUp,
  sort_desc: faSortDown,

  // actions
  add: faPlus,
  save: faFloppyDisk,
  filter_list: faFilter,
  favorite: faHeart,
  heart: faHeart,
  calendar: faCalendarDays,
  event_busy: faCalendarXmark,
  download: faDownload,
  play_arrow: faPlay,
  folder_plus: faFolderPlus,
  check: faCheck,
  check_circle: faCircleCheck,
  check_box: faSquareCheck,
  cancel: faCircleXmark,
  check_box_outline_blank: faSquare,
  close: faXmark,
  warning: faTriangleExclamation,
  delete: faTrash,
  edit: faPen,
  clone: faClone,
  drag_handle: faGripVertical,
  group_add: faUserPlus,
  person_add: faUserPlus,
  person_edit: faUserPen,
  set_lineup: faClipboardList,
  history: faClockRotateLeft,
  image: faImage,
  manage_accounts: faUserGear,
  person_remove: faUserMinus,
  remove_circle_outline: faCircleMinus,
  restart_alt: faArrowRotateRight,
  undo: faArrowRotateLeft,
  search: faMagnifyingGlass,
  manage_search: faMagnifyingGlassChart,

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
  ranking_star: faRankingStar,

  // view toggles
  grid_view: faTableCells,
  table_rows: faTableCells,
  view_list: faList,
  playlist_add: faLayerGroup,
  account_tree: faLayerGroup,

  // loading / time
  hourglass_empty: faHourglassHalf,

  // jersey number
  jersey: faHashtag,

  // swap / switch
  swap_horiz: faRightLeft,
  dark_mode: faMoon,
  light_mode: faSun,

  // decorative
  sports_hockey: faHockeyPuck,
  empty_net: faUserSlash,
  penalty_shot: faBullseye,
  celebration: faStar,
  stars: faStar,
  flag: faFlag,
  more_vert: faEllipsisVertical,
  more_time: faClock,
  schedule: faClock,

  api_search: faMagnifyingGlassChart,
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
