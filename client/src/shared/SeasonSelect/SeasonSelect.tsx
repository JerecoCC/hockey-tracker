import { useEffect, useMemo, useRef } from 'react';
import Select, { type SelectOption, type SelectWidth } from '@jerecocc/tracker-ui/components/Select/Select';
import {
  getLatestEndedSeasonId,
  getLatestSeasonId,
  sortSeasonsLatestFirst,
  type DefaultSeasonMode,
  type SeasonSelectRecord,
} from '@/lib/seasonSelection';

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
  defaultSeasonMode?: DefaultSeasonMode;
}

const buildSeasonOptions = <TSeason extends SeasonSelectRecord>(
  seasons: TSeason[],
): SelectOption[] =>
  sortSeasonsLatestFirst(seasons).map((season) => ({
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
    defaultSeasonMode = 'latest',
  } = props;
  const initializedKeyRef = useRef<string | null>(null);
  const seasonKey = seasons.map((season) => season.id).join('|');
  const initializedKey = `${defaultSeasonMode}:${seasonKey}`;
  const defaultSeasonId = useMemo(() => {
    if (defaultSeasonMode === 'none') return null;
    if (defaultSeasonMode === 'latest-ended') return getLatestEndedSeasonId(seasons);
    return getLatestSeasonId(seasons);
  }, [defaultSeasonMode, seasons]);
  const options = useMemo<SelectOption[]>(() => {
    const seasonOptions = buildSeasonOptions(seasons);
    return includeAllOption
      ? [{ value: allOptionValue, label: allOptionLabel }, ...seasonOptions]
      : seasonOptions;
  }, [allOptionLabel, allOptionValue, includeAllOption, seasons]);

  useEffect(() => {
    if (!defaultSeasonId || initializedKeyRef.current === initializedKey) return;
    initializedKeyRef.current = initializedKey;
    if (!value || (includeAllOption && value === allOptionValue)) {
      onChange(defaultSeasonId);
    }
  }, [allOptionValue, defaultSeasonId, includeAllOption, initializedKey, onChange, value]);

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
