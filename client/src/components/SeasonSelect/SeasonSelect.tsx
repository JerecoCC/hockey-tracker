import { useEffect, useMemo, useRef } from 'react';
import Select, { type SelectOption, type SelectWidth } from '@/components/Select/Select';

export interface SeasonSelectRecord {
  id: string;
  name: string;
  start_date?: string | null;
  created_at?: string | null;
  is_current?: boolean;
}

interface Props<TSeason extends SeasonSelectRecord> {
  value: string | null;
  seasons: TSeason[];
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  includeAllOption?: boolean;
  allOptionLabel?: string;
  allOptionValue?: string;
  width?: SelectWidth;
}

const sortLatestFirst = <TSeason extends SeasonSelectRecord>(seasons: TSeason[]) =>
  [...seasons].sort((a, b) => {
    const startCmp = (b.start_date ?? '').localeCompare(a.start_date ?? '');
    if (startCmp !== 0) return startCmp;
    const createdCmp = (b.created_at ?? '').localeCompare(a.created_at ?? '');
    if (createdCmp !== 0) return createdCmp;
    return b.name.localeCompare(a.name);
  });

export const getLatestSeasonId = <TSeason extends SeasonSelectRecord>(
  seasons: TSeason[],
): string | null => sortLatestFirst(seasons)[0]?.id ?? null;

export const buildSeasonOptions = <TSeason extends SeasonSelectRecord>(
  seasons: TSeason[],
): SelectOption[] =>
  sortLatestFirst(seasons).map((season) => ({
    value: season.id,
    label: season.is_current ? `${season.name} ✦` : season.name,
  }));

const SeasonSelect = <TSeason extends SeasonSelectRecord>(props: Props<TSeason>) => {
  const {
    value,
    seasons,
    onChange,
    placeholder = 'Select season...',
    emptyMessage = 'No seasons available',
    disabled = false,
    includeAllOption = false,
    allOptionLabel = 'All seasons',
    allOptionValue = 'all',
    width = 'full',
  } = props;
  const initializedKeyRef = useRef<string | null>(null);
  const seasonKey = seasons.map((season) => season.id).join('|');
  const latestSeasonId = useMemo(() => getLatestSeasonId(seasons), [seasons]);
  const options = useMemo<SelectOption[]>(() => {
    const seasonOptions = buildSeasonOptions(seasons);
    return includeAllOption
      ? [{ value: allOptionValue, label: allOptionLabel }, ...seasonOptions]
      : seasonOptions;
  }, [allOptionLabel, allOptionValue, includeAllOption, seasons]);

  useEffect(() => {
    if (!latestSeasonId || initializedKeyRef.current === seasonKey) return;
    initializedKeyRef.current = seasonKey;
    if (!value || (includeAllOption && value === allOptionValue)) {
      onChange(latestSeasonId);
    }
  }, [allOptionValue, includeAllOption, latestSeasonId, onChange, seasonKey, value]);

  return (
    <Select
      value={value}
      options={options}
      placeholder={placeholder}
      emptyMessage={emptyMessage}
      onChange={onChange}
      disabled={disabled || seasons.length === 0}
      width={width}
    />
  );
};

export default SeasonSelect;
