import type { Meta, StoryObj } from '@storybook/react-vite';
import Accordion from '@jerecocc/tracker-ui/Accordion';
import ActionOverlay from '@jerecocc/tracker-ui/ActionOverlay';
import AddRowBar from '@jerecocc/tracker-ui/AddRowBar';
import Button from '@jerecocc/tracker-ui/Button';
import Pagination, { PaginatedTable } from '@jerecocc/tracker-ui/Pagination';
import Section from '@jerecocc/tracker-ui/Section';
import Table, { type Column } from '@jerecocc/tracker-ui/Table';
import Tabs from '@jerecocc/tracker-ui/Tabs';
import Tag from '@jerecocc/tracker-ui/Tag';
import { noop, Stateful, StoryGrid, StoryPage, StoryPanel, StorySection } from './storyData';

const meta = {
  title: 'Shared Components/Structure',
  parameters: {
    docs: {
      description: {
        component: 'Shared layout surfaces, expandable sections, tables, tabs, and pagination.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

interface StandingRow {
  id: string;
  team: string;
  gp: number;
  wins: number;
  points: number;
}

const standings: StandingRow[] = [
  { id: 'mtl', team: 'Montreal Victoire', gp: 30, wins: 18, points: 42 },
  { id: 'min', team: 'Minnesota Frost', gp: 30, wins: 16, points: 39 },
  { id: 'bos', team: 'Boston Fleet', gp: 30, wins: 15, points: 36 },
];

const columns: Column<StandingRow>[] = [
  { header: 'Team', key: 'team', sortable: true },
  { header: 'GP', key: 'gp', sortable: true, align: 'right' },
  { header: 'W', key: 'wins', sortable: true, align: 'right' },
  { header: 'PTS', key: 'points', sortable: true, align: 'right' },
  {
    type: 'custom',
    header: 'Status',
    sortKey: 'status',
    render: (row) => (
      <Tag
        label={row.points >= 40 ? 'Clinched' : 'Race'}
        intent={row.points >= 40 ? 'success' : 'info'}
      />
    ),
  },
];

export const Surfaces = {
  render: () => (
    <StoryPage>
      <StorySection title="Card">
        <StoryGrid>
          <Section
            title="Filled Card"
            action={
              <Button
                size="medium"
                icon="add"
                onClick={noop}
              >
                Add
              </Button>
            }
          >
            <p style={{ margin: 0 }}>Primary app surface with header actions.</p>
          </Section>
          <Section
            variant="light"
            title="Light Card"
          >
            <p style={{ margin: 0 }}>Light variant for neutral document-like surfaces.</p>
          </Section>
          <Section
            variant="border"
            title="Border Card"
          >
            <p style={{ margin: 0 }}>
              Border-only surface for nested sections that should align with framed list items.
            </p>
          </Section>
        </StoryGrid>
      </StorySection>

      <StorySection title="Accordion">
        <Accordion
          label="Playoff Bracket Rule"
          labelMeta={<Tag label="3 matchups" />}
          headerRight={<Tag label="Active" intent="success" />}
          hoverActions={[
            { icon: 'edit', tooltip: 'Edit', onClick: noop },
            { icon: 'delete', intent: 'danger', tooltip: 'Delete', onClick: noop },
          ]}
        >
          <p style={{ margin: 0 }}>
            Collapsible body content can hold grouped fields, matchup rows, or compact lists.
          </p>
        </Accordion>
      </StorySection>

      <StorySection title="Tabs">
        <Tabs
          tabs={[
            { label: 'Info', icon: 'info', content: <StoryPanel>Info panel</StoryPanel> },
            { label: 'Players', icon: 'group', content: <StoryPanel>Players panel</StoryPanel> },
            {
              label: 'Awards',
              icon: 'emoji_events',
              content: <StoryPanel>Awards panel</StoryPanel>,
            },
          ]}
          keepMounted
        />
      </StorySection>
    </StoryPage>
  ),
} satisfies Story;

export const TablesAndPagination = {
  render: () => (
    <StoryPage>
      <StorySection title="Table">
        <StoryPanel>
          <Table
            columns={columns}
            data={standings}
            rowKey={(row) => row.id}
            activeSortKey="points"
            sortDir="desc"
            onSort={noop}
            onRowClick={noop}
          />
        </StoryPanel>
      </StorySection>
      <StorySection title="Pagination">
        <StoryGrid>
          <StoryPanel>
            <Stateful initial={2}>
              {(page, setPage) => (
                <Pagination
                  page={page}
                  pageSize={15}
                  total={64}
                  onPageChange={setPage}
                />
              )}
            </Stateful>
          </StoryPanel>
          <StoryPanel>
            <PaginatedTable
              columns={columns}
              data={standings}
              rowKey={(row) => row.id}
              page={1}
              pageSize={2}
              total={6}
              fetching
              onPageChange={noop}
            />
          </StoryPanel>
        </StoryGrid>
      </StorySection>
    </StoryPage>
  ),
} satisfies Story;

export const RowHelpers = {
  render: () => (
    <StoryGrid>
      <StoryPanel>
        <AddRowBar
          label="Add Position"
          hint="3 of 6 slots"
          onClick={noop}
        />
      </StoryPanel>
      <StoryPanel>
        <div
          style={{ position: 'relative', minHeight: 56, padding: 12, border: '1px solid #334155' }}
        >
          Hover target
          <ActionOverlay className="storybook-overlay-visible">
            <Button
              size="medium"
              variant="outlined"
              intent="neutral"
              icon="edit"
              onClick={noop}
            />
            <Button
              size="medium"
              variant="outlined"
              intent="danger"
              icon="delete"
              onClick={noop}
            />
          </ActionOverlay>
        </div>
      </StoryPanel>
    </StoryGrid>
  ),
} satisfies Story;
