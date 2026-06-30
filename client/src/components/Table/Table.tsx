import { ReactNode } from 'react';
import Icon from '../Icon/Icon';
import TeamLogo from '../TeamLogo/TeamLogo';
import Tooltip from '../Tooltip/Tooltip';
import styles from './Table.module.scss';

export type Column<T> =
  | {
      type?: 'text';
      header: ReactNode;
      key: keyof T;
      sortable?: true;
      align?: 'left' | 'center' | 'right';
    }
  | {
      type: 'date';
      header: ReactNode;
      key: keyof T;
      sortable?: true;
      align?: 'left' | 'center' | 'right';
    }
  | {
      type: 'logo';
      header: ReactNode;
      getLogo: (row: T) => string | null | undefined;
      getLogoDark?: (row: T) => string | null | undefined;
      getLogoLight?: (row: T) => string | null | undefined;
      getName: (row: T) => string;
      getCode: (row: T) => string;
      sortable?: true;
      sortKey?: string;
      align?: 'left' | 'center' | 'right';
    }
  | {
      type: 'custom';
      header: ReactNode;
      render: (row: T) => ReactNode;
      sortable?: true;
      sortKey?: string;
      align?: 'left' | 'center' | 'right';
    };

const renderCell = <T,>(col: Column<T>, row: T): ReactNode => {
  if (col.type === 'custom') return col.render(row);
  if (col.type === 'date') return String(row[col.key]).slice(0, 10).replace(/-/g, '/');
  if (col.type === 'logo') {
    const src = col.getLogo(row);
    const logoDark = col.getLogoDark?.(row);
    const logoLight = col.getLogoLight?.(row);
    const name = col.getName(row);
    const code = col.getCode(row);
    return (
      <Tooltip text={name}>
        <TeamLogo
          logo={src}
          logoDark={logoDark}
          logoLight={logoLight}
          code={code}
          alt={name}
          size={32}
          shape="square"
          className={src || logoDark || logoLight ? styles.logoThumb : styles.logoPlaceholder}
        />
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
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T, index: number) => string | undefined;
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
  onRowClick,
  rowClassName,
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
            {columns.map((col, index) => {
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
                  key={colKey ?? index}
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
            data.map((row, rowIndex) => {
              const rowClasses = [
                onRowClick ? styles.clickableRow : undefined,
                rowClassName?.(row, rowIndex),
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={rowClasses || undefined}
                >
                  {columns.map((col, index) => (
                    <td
                      key={`${rowKey(row)}-${getColSortKey(col) ?? index}`}
                      style={col.align ? { textAlign: col.align } : undefined}
                    >
                      {renderCell(col, row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
