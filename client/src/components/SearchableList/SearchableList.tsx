import { ReactNode, useState } from 'react';
import SearchField from '../SearchField/SearchField';
import styles from './SearchableList.module.scss';

interface Props<T> {
  /** Full unfiltered item list. */
  items: T[];
  /** Returns true when the item matches the current query. */
  filterFn: (item: T, query: string) => boolean;
  /** Renders the matched items (e.g. a <ul>). Only called when there are results. */
  renderItems: (filtered: T[]) => ReactNode;
  placeholder?: string;
  /** Buttons / selects to place in the toolbar beside the search field. */
  actions?: ReactNode;
  query?: string;
  onQueryChange?: (query: string) => void;
  disableClientFilter?: boolean;
  loading?: boolean;
  loadingMessage?: string;
  /** Shown when items is empty and no query is active. */
  emptyMessage: ReactNode;
  /** Shown when items is non-empty but the filter matches nothing. Receives the current query. */
  noResultsMessage?: (query: string) => ReactNode;
  className?: string;
}

function SearchableList<T>({
  items,
  filterFn,
  renderItems,
  placeholder = 'Search…',
  actions,
  query: controlledQuery,
  onQueryChange,
  disableClientFilter = false,
  loading = false,
  loadingMessage = 'Loading…',
  emptyMessage,
  noResultsMessage,
  className,
}: Props<T>) {
  const [internalQuery, setInternalQuery] = useState('');
  const query = controlledQuery ?? internalQuery;
  const setQuery = (value: string) => {
    if (controlledQuery === undefined) setInternalQuery(value);
    onQueryChange?.(value);
  };
  const trimmed = query.trim();
  const filtered =
    trimmed && !disableClientFilter ? items.filter((item) => filterFn(item, trimmed)) : items;

  const resolveNoResults = noResultsMessage
    ? noResultsMessage(query)
    : `No results match "${query}".`;

  return (
    <div className={className}>
      <div className={styles.toolbar}>
        <SearchField
          placeholder={placeholder}
          value={query}
          onChange={setQuery}
        />
        {actions}
      </div>

      {loading ? (
        <p className={styles.empty}>{loadingMessage}</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>{trimmed ? resolveNoResults : emptyMessage}</p>
      ) : filtered.length === 0 ? (
        <p className={styles.empty}>{resolveNoResults}</p>
      ) : (
        renderItems(filtered)
      )}
    </div>
  );
}

export default SearchableList;
