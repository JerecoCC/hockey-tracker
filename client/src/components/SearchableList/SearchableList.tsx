import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import SearchField from '../SearchField/SearchField';
import Skeleton from '../Skeleton/Skeleton';
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
  searchDebounceMs?: number;
  minSearchLength?: number;
  disableClientFilter?: boolean;
  loading?: boolean;
  loadingMessage?: string;
  loadingContent?: ReactNode;
  loadingRowCount?: number;
  loadingFooter?: ReactNode;
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
  searchDebounceMs = 0,
  minSearchLength = 0,
  disableClientFilter = false,
  loading = false,
  loadingMessage = 'Loading…',
  loadingContent,
  loadingRowCount = 0,
  loadingFooter,
  emptyMessage,
  noResultsMessage,
  className,
}: Props<T>) {
  const [internalQuery, setInternalQuery] = useState('');
  const query = controlledQuery ?? internalQuery;
  const usesRequestSearch = searchDebounceMs > 0 || minSearchLength > 0;
  const onQueryChangeRef = useRef(onQueryChange);
  const normalizeRequestQuery = useCallback((value: string) => {
    const trimmed = value.trim();
    return trimmed.length >= minSearchLength ? trimmed : '';
  }, [minSearchLength]);
  const lastRequestedQueryRef = useRef(usesRequestSearch ? normalizeRequestQuery(query) : query);
  const setQuery = (value: string) => {
    if (controlledQuery === undefined) setInternalQuery(value);
    if (!usesRequestSearch) onQueryChange?.(value);
  };

  useEffect(() => {
    onQueryChangeRef.current = onQueryChange;
  }, [onQueryChange]);

  useEffect(() => {
    if (!usesRequestSearch) return;
    const nextQuery = normalizeRequestQuery(query);
    const timeoutId = window.setTimeout(() => {
      if (lastRequestedQueryRef.current === nextQuery) return;
      lastRequestedQueryRef.current = nextQuery;
      onQueryChangeRef.current?.(nextQuery);
    }, searchDebounceMs);

    return () => window.clearTimeout(timeoutId);
  }, [normalizeRequestQuery, query, searchDebounceMs, usesRequestSearch]);

  const trimmed = query.trim();
  const filtered =
    trimmed && !disableClientFilter ? items.filter((item) => filterFn(item, trimmed)) : items;

  const resolveNoResults = noResultsMessage
    ? noResultsMessage(query)
    : `No results match "${query}".`;
  const loadingBody =
    loadingContent ??
    (loadingRowCount > 0 ? (
      <>
        <ul
          className={styles.loadingList}
          aria-hidden="true"
        >
          {Array.from({ length: loadingRowCount }, (_, index) => (
            <Skeleton
              as="li"
              key={index}
              type="card"
              className={styles.loadingRow}
            />
          ))}
        </ul>
        {loadingFooter}
      </>
    ) : (
      <p className={styles.empty}>{loadingMessage}</p>
    ));

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
        loadingBody
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
