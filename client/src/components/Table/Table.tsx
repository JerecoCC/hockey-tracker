import { ReactNode } from 'react';
import Icon from '../Icon/Icon';
import Tooltip from '../Tooltip/Tooltip';
import styles from './Table.module.scss';

export type Column<T> =
  | {
      type?: 'text';
      header: string;
      key: keyof T;
      sortable?: true;
      align?: 'left' | 'center' | 'right';
    }
  | {
      type: 'date';
      header: string;
      key: keyof T;
      sortable?: true;
      align?: 'left' | 'center' | 'right';
    }
  | {
      type: 'logo';
      header: string;
      getLogo: (row: T) => string | null | undefined;
      getName: (row: T) => string;
      getCode: (row: T) => string;
      sortable?: true;
      sortKey?: string;
      align?: 'left' | 'center' | 'right';
    }
  | {
      type: 'custom';
      header: string;
      render: (row: T) => ReactNode;
      sortable?: true;
      sortKey?: string;
      align?: 'left' | 'center' | 'right';
    };

const renderCell = <T,>(col: Column<T>, row: T): ReactNode => {
  if (col.type === 'custom') return col.render(row);
  if (col.type === 'date') return new Date(row[col.key] as string).toLocaleDateString();
  if (col.type === 'logo') {
    const src = col.getLogo(row);
    const name = col.getName(row);
    const code = col.getCode(row);
    return (
      <Tooltip text={name}>
        {src ? (
          <img
            src={src}
            alt={name}
            className={styles.logoThumb}
          />
        ) : (
          <span className={styles.logoPlaceholder}>{code.slice(0, 3)}</span>
        )}
      </Tooltip>
    );
  }
  return String(row[col.key] ?? '');
};

/** Returns the sort key string for a column, or undefined if it can't be sorted. */
const getColSortKey = <T,>(col: Column<T>): string | undefined => {
  if (col.type === 'custom' || col.type === 'logo') return col.sortKey;
  if ('key' in col) return String(col.key);
  return undefined;
};

const alignToJustify = (align?: 'left' | 'center' | 'right') =>
  align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  activeSortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string, dir: 'asc' | 'desc') => void;
}

const Table = <T,>({
  columns,
  data,
  rowKey,
  loading = false,
  emptyMessage = 'No results found.',
  activeSortKey,
  sortDir = 'asc',
  onSort,
}: TableProps<T>) => {
  if (loading) {
    return (
      <div className={styles.loaderWrapper}>
        <span className={styles.spinner} />
        <p className={styles.loaderText}>Loading…</p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table>
        <thead>
          <tr>
            {columns.map((col) => {
              const colKey = getColSortKey(col);
              const isActive = col.sortable && !!colKey && colKey === activeSortKey;
              const handleClick =
                col.sortable && colKey
                  ? () => {
                      const newDir = isActive && sortDir === 'asc' ? 'desc' : 'asc';
                      onSort?.(colKey, newDir);
                    }
                  : undefined;

              return (
                <th
                  key={col.header}
                  style={col.align ? { textAlign: col.align } : undefined}
                  className={col.sortable ? styles.thSortable : undefined}
                >
                  {col.sortable && handleClick ? (
                    <button
                      className={styles.sortBtn}
                      style={{ justifyContent: alignToJustify(col.align) }}
                      onClick={handleClick}
                    >
                      {col.header}
                      <Icon
                        name={isActive ? (sortDir === 'asc' ? 'sort_asc' : 'sort_desc') : 'sort'}
                        className={`${styles.sortIcon}${isActive ? ` ${styles.sortActive}` : ''}`}
                      />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className={styles.emptyMsg}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((col) => (
                  <td
                    key={col.header}
                    style={col.align ? { textAlign: col.align } : undefined}
                  >
                    {renderCell(col, row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
