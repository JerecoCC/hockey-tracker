import { useEffect, useId, useState } from 'react';
import Button from '../Button/Button';
import Table, { type Column } from '../Table/Table';
import styles from './Pagination.module.scss';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

const PAGE_JUMP_DEBOUNCE_MS = 500;

const Pagination = ({ page, pageSize, total, onPageChange, className }: PaginationProps) => {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const start = (currentPage - 1) * pageSize;
  const [pageInput, setPageInput] = useState(String(currentPage));
  const pageJumpId = useId();

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    if (total <= pageSize) return undefined;

    const trimmedPageInput = pageInput.trim();
    if (!trimmedPageInput) return undefined;

    const timeoutId = window.setTimeout(() => {
      const requestedPage = Number(trimmedPageInput);

      if (!Number.isFinite(requestedPage)) {
        setPageInput(String(currentPage));
        return;
      }

      const nextPage = Math.min(pageCount, Math.max(1, Math.trunc(requestedPage)));
      if (String(nextPage) !== trimmedPageInput) setPageInput(String(nextPage));
      if (nextPage !== currentPage) onPageChange(nextPage);
    }, PAGE_JUMP_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [currentPage, onPageChange, pageCount, pageInput, pageSize, total]);

  if (total <= pageSize) return null;

  return (
    <div className={[styles.pagination, className].filter(Boolean).join(' ')}>
      <span className={styles.summary}>
        {start + 1}-{Math.min(start + pageSize, total)} of {total}
      </span>
      <div className={styles.actions}>
        <Button
          variant="outlined"
          intent="neutral"
          icon="first_page"
          tooltip="First page"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
        />
        <Button
          variant="outlined"
          intent="neutral"
          icon="chevron_left"
          tooltip="Previous page"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        />
        <span className={styles.page}>
          <label htmlFor={pageJumpId}>Page</label>
          <input
            id={pageJumpId}
            className={styles.pageInput}
            type="number"
            min={1}
            max={pageCount}
            inputMode="numeric"
            value={pageInput}
            onChange={(event) => setPageInput(event.target.value)}
            onBlur={() => {
              if (!pageInput.trim()) setPageInput(String(currentPage));
            }}
            aria-label="Page number"
          />
          <span>of {pageCount}</span>
        </span>
        <Button
          variant="outlined"
          intent="neutral"
          icon="chevron_right"
          tooltip="Next page"
          disabled={currentPage >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
        />
        <Button
          variant="outlined"
          intent="neutral"
          icon="last_page"
          tooltip="Last page"
          disabled={currentPage >= pageCount}
          onClick={() => onPageChange(pageCount)}
        />
      </div>
    </div>
  );
};

interface PaginatedTableProps<T> extends PaginationProps {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  fetching?: boolean;
  emptyMessage?: string;
  activeSortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string, dir: 'asc' | 'desc') => void;
  onRowClick?: (row: T) => void;
  loadingMessage?: string;
}

export const PaginatedTable = <T,>({
  columns,
  data,
  rowKey,
  loading = false,
  fetching = false,
  emptyMessage,
  activeSortKey,
  sortDir,
  onSort,
  onRowClick,
  loadingMessage = 'Loading page...',
  page,
  pageSize,
  total,
  onPageChange,
  className,
}: PaginatedTableProps<T>) => (
  <div className={[styles.paginatedTable, className].filter(Boolean).join(' ')}>
    <div className={styles.tableShell}>
      <Table
        columns={columns}
        data={data}
        rowKey={rowKey}
        loading={loading}
        emptyMessage={emptyMessage}
        activeSortKey={activeSortKey}
        sortDir={sortDir}
        onSort={onSort}
        onRowClick={onRowClick}
      />
      {fetching && !loading && (
        <div
          className={styles.loadingOverlay}
          aria-live="polite"
          aria-label={loadingMessage}
        >
          <span className={styles.overlaySpinner} />
          <span className={styles.overlayText}>{loadingMessage}</span>
        </div>
      )}
    </div>
    <Pagination
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={onPageChange}
    />
  </div>
);

export default Pagination;
