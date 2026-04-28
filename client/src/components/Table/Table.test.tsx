import { render, screen } from '@testing-library/react';
import Table, { Column } from '@/components/Table/Table';

interface Item {
  id: string;
  name: string;
  created: string;
}

const columns: Column<Item>[] = [
  { header: 'Name', key: 'name' },
  { type: 'date', header: 'Created', key: 'created' },
  { type: 'custom', header: 'Actions', render: (row) => <button>{`action-${row.id}`}</button> },
];

const data: Item[] = [
  { id: '1', name: 'Alpha', created: '2024-01-15T00:00:00.000Z' },
  { id: '2', name: 'Beta', created: '2024-06-01T00:00:00.000Z' },
];

describe('Table', () => {
  it('shows loading text and hides the table when loading=true', () => {
    render(
      <Table
        columns={columns}
        data={[]}
        rowKey={(r) => r.id}
        loading
      />,
    );
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the default empty message when data is empty', () => {
    render(
      <Table
        columns={columns}
        data={[]}
        rowKey={(r) => r.id}
      />,
    );
    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });

  it('shows a custom empty message when provided', () => {
    render(
      <Table
        columns={columns}
        data={[]}
        rowKey={(r) => r.id}
        emptyMessage="Nothing here"
      />,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('renders all column headers', () => {
    render(
      <Table
        columns={columns}
        data={data}
        rowKey={(r) => r.id}
      />,
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('renders text column values for each row', () => {
    render(
      <Table
        columns={columns}
        data={data}
        rowKey={(r) => r.id}
      />,
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('formats date columns as YYYY/MM/DD', () => {
    render(
      <Table
        columns={columns}
        data={data}
        rowKey={(r) => r.id}
      />,
    );
    expect(screen.getByText('2024/01/15')).toBeInTheDocument();
  });

  it('renders custom column via render prop', () => {
    render(
      <Table
        columns={columns}
        data={data}
        rowKey={(r) => r.id}
      />,
    );
    expect(screen.getByText('action-1')).toBeInTheDocument();
    expect(screen.getByText('action-2')).toBeInTheDocument();
  });

  it('applies textAlign style to headers when align is set', () => {
    const alignedCols: Column<Item>[] = [{ header: 'Name', key: 'name', align: 'center' }];
    render(
      <Table
        columns={alignedCols}
        data={data}
        rowKey={(r) => r.id}
      />,
    );
    const th = screen.getByRole('columnheader', { name: 'Name' });
    expect(th).toHaveStyle({ textAlign: 'center' });
  });

  it('applies textAlign style to data cells when align is set', () => {
    const alignedCols: Column<Item>[] = [{ header: 'Name', key: 'name', align: 'right' }];
    render(
      <Table
        columns={alignedCols}
        data={data}
        rowKey={(r) => r.id}
      />,
    );
    const cells = screen.getAllByRole('cell');
    cells.forEach((cell) => expect(cell).toHaveStyle({ textAlign: 'right' }));
  });

  it('does not apply textAlign when align is not set', () => {
    const noAlignCols: Column<Item>[] = [{ header: 'Name', key: 'name' }];
    render(
      <Table
        columns={noAlignCols}
        data={data}
        rowKey={(r) => r.id}
      />,
    );
    const th = screen.getByRole('columnheader', { name: 'Name' });
    expect(th.style.textAlign).toBe('');
  });
});
