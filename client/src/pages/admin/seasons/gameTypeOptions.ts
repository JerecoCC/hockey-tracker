import type { SelectOption } from '@jerecocc/tracker-ui/components/Select/Select';

// Playoff games are created from the playoff series flow, so they are not offered here.
export const CREATE_GAME_TYPE_OPTIONS: SelectOption[] = [
  { value: 'preseason', label: 'Preseason' },
  { value: 'regular', label: 'Regular Season' },
];
