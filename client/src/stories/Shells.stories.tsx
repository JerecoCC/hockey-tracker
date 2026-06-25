import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, type ReactNode } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import AdminLayout from '@/components/AdminLayout/AdminLayout';
import AdminNav from '@/components/AdminNav/AdminNav';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import PageHeader from '@/components/PageHeader/PageHeader';
import Tag from '@/components/Tag/Tag';
import TitleRow from '@/components/TitleRow/TitleRow';
import UserLayout from '@/components/UserLayout/UserLayout';
import UserNav from '@/components/UserNav/UserNav';
import { noop, StoryGrid, StoryPage, StoryPanel, StorySection } from './storyData';

const meta = {
  title: 'Shared Components/Shells',
  parameters: {
    docs: {
      description: {
        component: 'Shared admin/user shell components, navigation, page header, and title row.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const RouteSeed = ({ to, children }: { to: string; children: ReactNode }) => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(to, { replace: true });
  }, [navigate, to]);

  return <>{children}</>;
};

const ShellContent = ({ title }: { title: string }) => (
  <>
    <TitleRow
      left={
        <Button
          icon="arrow_back"
          variant="outlined"
          intent="neutral"
          onClick={noop}
        >
          Back
        </Button>
      }
      right={<Tag label="Storybook" intent="info" />}
    />
    <Card
      title={title}
      action={
        <Button
          size="sm"
          icon="add"
          onClick={noop}
        >
          Create
        </Button>
      }
    >
      <p style={{ margin: 0 }}>Layout content renders through the shared route outlet.</p>
    </Card>
  </>
);

export const NavigationAndHeader = {
  render: () => (
    <RouteSeed to="/admin/leagues">
      <StoryPage>
        <StorySection title="PageHeader">
          <StoryPanel>
            <PageHeader onMenuToggle={noop} />
          </StoryPanel>
        </StorySection>

        <StorySection title="Navigation">
          <StoryGrid>
            <div className="storybook-layout-frame" style={{ height: 360 }}>
              <AdminNav
                collapsed={false}
                onToggle={noop}
              />
            </div>
            <div className="storybook-layout-frame" style={{ height: 360 }}>
              <UserNav
                collapsed={false}
                onToggle={noop}
              />
            </div>
          </StoryGrid>
        </StorySection>

        <StorySection title="TitleRow">
          <StoryPanel>
            <TitleRow
              left={
                <Button
                  icon="arrow_back"
                  variant="outlined"
                  intent="neutral"
                  onClick={noop}
                >
                  Back to league
                </Button>
              }
              right={<Tag label="Current season" intent="success" />}
            />
          </StoryPanel>
        </StorySection>
      </StoryPage>
    </RouteSeed>
  ),
} satisfies Story;

export const AdminShell = {
  render: () => (
    <RouteSeed to="/admin/leagues">
      <div className="storybook-layout-frame">
        <Routes>
          <Route
            path="/admin/leagues"
            element={<AdminLayout />}
          >
            <Route
              index
              element={<ShellContent title="League Admin" />}
            />
          </Route>
        </Routes>
      </div>
    </RouteSeed>
  ),
} satisfies Story;

export const UserShell = {
  render: () => (
    <RouteSeed to="/dashboard">
      <div className="storybook-layout-frame">
        <Routes>
          <Route
            path="/dashboard"
            element={<UserLayout />}
          >
            <Route
              index
              element={<ShellContent title="Dashboard" />}
            />
          </Route>
        </Routes>
      </div>
    </RouteSeed>
  ),
} satisfies Story;
