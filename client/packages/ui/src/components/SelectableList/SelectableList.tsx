import { useMemo, useState, type ReactNode } from 'react';
import Divider from '../Divider/Divider';
import SearchField from '../SearchField/SearchField';
import SelectableListItem, {
  type SelectableListItemProps,
} from '../SelectableListItem/SelectableListItem';
import styles from './SelectableList.module.scss';

type SelectableListItemConfig = Omit<
  SelectableListItemProps,
  'checked' | 'onToggle' | 'rightContent'
>;

interface Props<T> {
  items: T[];
  getItemKey: (item: T) => string;
  isSelected: (item: T) => boolean;
  onToggle: (item: T) => void;
  getItemProps: (item: T) => SelectableListItemConfig;
  getItemRightContent?: (item: T) => ReactNode;
  filterItem?: (item: T, query: string) => boolean;
  query?: string;
  onQueryChange?: (query: string) => void;
  searchPlaceholder?: string;
  searchDisabled?: boolean;
  searchAutoFocus?: boolean;
  searchRightContent?: ReactNode;
  emptyMessage: ReactNode;
  noResultsMessage?: (query: string) => ReactNode;
  sortSelectedFirst?: boolean;
  className?: string;
  toolbarClassName?: string;
  searchClassName?: string;
  dividerClassName?: string;
  listClassName?: string;
  emptyClassName?: string;
}

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

function SelectableList<T>({
  items,
  getItemKey,
  isSelected,
  onToggle,
  getItemProps,
  getItemRightContent,
  filterItem,
  query: controlledQuery,
  onQueryChange,
  searchPlaceholder = 'Search...',
  searchDisabled,
  searchAutoFocus,
  searchRightContent,
  emptyMessage,
  noResultsMessage,
  sortSelectedFirst = true,
  className,
  toolbarClassName,
  searchClassName,
  dividerClassName,
  listClassName,
  emptyClassName,
}: Props<T>) {
  const [internalQuery, setInternalQuery] = useState('');
  const query = controlledQuery ?? internalQuery;
  const trimmedQuery = query.trim();

  const setQuery = (value: string) => {
    if (controlledQuery === undefined) setInternalQuery(value);
    onQueryChange?.(value);
  };

  const filteredItems = useMemo(
    () =>
      trimmedQuery && filterItem
        ? items.filter((item) => filterItem(item, trimmedQuery))
        : items,
    [filterItem, items, trimmedQuery],
  );

  const displayedItems = useMemo(() => {
    if (!sortSelectedFirst) return filteredItems;
    return filteredItems
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const aSelected = isSelected(a.item);
        const bSelected = isSelected(b.item);
        if (aSelected !== bSelected) return aSelected ? -1 : 1;
        return a.index - b.index;
      })
      .map(({ item }) => item);
  }, [filteredItems, isSelected, sortSelectedFirst]);

  const noResults =
    noResultsMessage?.(query) ?? `No results match "${query}".`;

  return (
    <div className={cx(styles.root, className)}>
      <div className={cx(styles.toolbar, toolbarClassName)}>
        <SearchField
          className={cx(styles.search, searchClassName)}
          placeholder={searchPlaceholder}
          value={query}
          onChange={setQuery}
          disabled={searchDisabled}
          autoFocus={searchAutoFocus}
        />
        {searchRightContent}
      </div>
      <Divider className={cx(styles.divider, dividerClassName)} />

      {items.length === 0 ? (
        <p className={cx(styles.empty, emptyClassName)}>{emptyMessage}</p>
      ) : displayedItems.length === 0 ? (
        <p className={cx(styles.empty, emptyClassName)}>{noResults}</p>
      ) : (
        <ul className={cx(styles.list, listClassName)}>
          {displayedItems.map((item) => (
            <SelectableListItem
              key={getItemKey(item)}
              {...getItemProps(item)}
              checked={isSelected(item)}
              onToggle={() => onToggle(item)}
              rightContent={getItemRightContent?.(item)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export default SelectableList;
