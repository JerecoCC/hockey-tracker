import { useMemo, useState, type ReactNode } from 'react';
import Divider from '../Divider/Divider';
import SearchField from '../SearchField/SearchField';
import SelectableListItem, {
  type SelectableListItemProps,
} from '../SelectableListItem/SelectableListItem';
import styles from './Checklist.module.scss';

export interface ChecklistOption
  extends Omit<SelectableListItemProps, 'checked' | 'onToggle'> {
  id: string;
  searchText?: string;
}

interface ChecklistProps<Option extends ChecklistOption> {
  options: Option[];
  selectedIds: readonly string[] | Set<string>;
  onToggle: (option: Option) => void;
  searchable?: boolean;
  query?: string;
  onQueryChange?: (query: string) => void;
  filterOption?: (option: Option, query: string) => boolean;
  placeholder?: string;
  autoFocus?: boolean;
  searchDisabled?: boolean;
  actions?: ReactNode;
  emptyMessage: ReactNode;
  noResultsMessage?: (query: string) => ReactNode;
  disabled?: boolean;
  className?: string;
  toolbarClassName?: string;
  searchClassName?: string;
  dividerClassName?: string;
  listClassName?: string;
  emptyClassName?: string;
}

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

const defaultFilterOption = (option: ChecklistOption, query: string) =>
  [option.searchText, option.name, option.subtitle]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(query.toLowerCase());

function Checklist<Option extends ChecklistOption>({
  options,
  selectedIds,
  onToggle,
  searchable = false,
  query: controlledQuery,
  onQueryChange,
  filterOption = defaultFilterOption,
  placeholder = 'Search...',
  autoFocus = false,
  searchDisabled = false,
  actions,
  emptyMessage,
  noResultsMessage,
  disabled = false,
  className,
  toolbarClassName,
  searchClassName,
  dividerClassName,
  listClassName,
  emptyClassName,
}: ChecklistProps<Option>) {
  const [internalQuery, setInternalQuery] = useState('');
  const query = controlledQuery ?? internalQuery;
  const trimmedQuery = query.trim();
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const setQuery = (value: string) => {
    if (controlledQuery === undefined) setInternalQuery(value);
    onQueryChange?.(value);
  };

  const filteredOptions = useMemo(
    () =>
      searchable && trimmedQuery
        ? options.filter((option) => filterOption(option, trimmedQuery))
        : options,
    [filterOption, options, searchable, trimmedQuery],
  );

  const displayedOptions = useMemo(
    () =>
      filteredOptions
        .map((option, index) => ({ option, index }))
        .sort((a, b) => {
          const aSelected = selectedSet.has(a.option.id);
          const bSelected = selectedSet.has(b.option.id);
          if (aSelected !== bSelected) return aSelected ? -1 : 1;
          return a.index - b.index;
        })
        .map(({ option }) => option),
    [filteredOptions, selectedSet],
  );

  const noResults = noResultsMessage?.(query) ?? `No results match "${query}".`;

  return (
    <div className={cx(styles.root, className)}>
      {searchable && (
        <>
          <div className={cx(styles.toolbar, toolbarClassName)}>
            <SearchField
              className={cx(styles.search, searchClassName)}
              placeholder={placeholder}
              value={query}
              onChange={setQuery}
              disabled={searchDisabled}
              autoFocus={autoFocus}
            />
            {actions}
          </div>
          <Divider className={cx(styles.divider, dividerClassName)} />
        </>
      )}

      {options.length === 0 ? (
        <p className={cx(styles.empty, emptyClassName)}>{emptyMessage}</p>
      ) : displayedOptions.length === 0 ? (
        <p className={cx(styles.empty, emptyClassName)}>{noResults}</p>
      ) : (
        <ul className={cx(styles.list, listClassName)}>
          {displayedOptions.map((option) => (
            <SelectableListItem
              key={option.id}
              {...option}
              checked={selectedSet.has(option.id)}
              disabled={disabled || option.disabled}
              onToggle={() => onToggle(option)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export default Checklist;
