import { ReactNode, useState } from 'react';
import Icon from '../Icon/Icon';
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
  loading = false,
  loadingMessage = 'Loading…',
  emptyMessage,
  noResultsMessage,
  className,
}: Props<T>) {
  const [query, setQuery] = useState('');
  const trimmed = query.trim();
  const filtered = trimmed ? items.filter((item) => filterFn(item, trimmed)) : items;

  const resolveNoResults = noResultsMessage
    ? noResultsMessage(query)
    : `No results match "${query}".`;

  return (
    <div className={className}>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Icon
            name="search"
            size="1em"
            className={styles.searchIcon}
          />
          <input
            className={styles.searchInput}
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className={styles.searchClear}
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              <Icon
                name="close"
                size="0.8em"
              />
            </button>
          )}
        </div>
        {actions}
      </div>

      {loading ? (
        <p className={styles.empty}>{loadingMessage}</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>{emptyMessage}</p>
      ) : filtered.length === 0 ? (
        <p className={styles.empty}>{resolveNoResults}</p>
      ) : (
        renderItems(filtered)
      )}
    </div>
  );
}

export default SearchableList;
