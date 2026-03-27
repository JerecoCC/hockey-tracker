import { ReactNode } from 'react';
import styles from './Table.module.scss';

export type Column<T> =
  | {
      type?: 'text';
      header: string;
      key: keyof T;
      align?: 'left' | 'center' | 'right';
    }
  | {
      type: 'date';
      header: string;
      key: keyof T;
      align?: 'left' | 'center' | 'right';
    }
  | {
      type: 'logo';
      header: string;
      getLogo: (row: T) => string | null | undefined;
      getName: (row: T) => string;
      getCode: (row: T) => string;
      align?: 'left' | 'center' | 'right';
    }
  | {
      type: 'custom';
      header: string;
      render: (row: T) => ReactNode;
      align?: 'left' | 'center' | 'right';
    };

const renderCell = <T,>(col: Column<T>, row: T): ReactNode => {
  if (col.type === 'custom') return col.render(row);
  if (col.type === 'date') return new Date(row[col.key] as string).toLocaleDateString();
  if (col.type === 'logo') {
    const src = col.getLogo(row);
    const name = col.getName(row);
    const code = col.getCode(row);
    return src ? (
      <img
        src={src}
        alt={name}
        title={name}
        className={styles.logoThumb}
      />
    ) : (
      <span
        className={styles.logoPlaceholder}
        title={name}
      >
        {code.slice(0, 3)}
      </span>
    );
  }
  return String(row[col.key] ?? '');
};

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
}

const Table = <T,>({
  columns,
  data,
  rowKey,
  loading = false,
  emptyMessage = 'No results found.',
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
            {columns.map((col) => (
              <th
                key={col.header}
                style={col.align ? { textAlign: col.align } : undefined}
              >
                {col.header}
              </th>
            ))}
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
