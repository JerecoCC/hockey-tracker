import type { Meta, StoryObj } from '@storybook/react-vite';
import Breadcrumbs from '@jerecocc/tracker-ui/components/Breadcrumbs/Breadcrumbs';
import BreadcrumbTitleRow from '@jerecocc/tracker-ui/components/Breadcrumbs/BreadcrumbTitleRow';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import ColorSwatch from '@jerecocc/tracker-ui/components/ColorSwatch/ColorSwatch';
import EntityHeader from '@jerecocc/tracker-ui/components/EntityHeader/EntityHeader';
import InfoItem from '@jerecocc/tracker-ui/components/InfoItem/InfoItem';
import ListItem from '@jerecocc/tracker-ui/components/ListItem/ListItem';
import MoreActionsMenu from '@jerecocc/tracker-ui/components/MoreActionsMenu/MoreActionsMenu';
import SearchableList from '@jerecocc/tracker-ui/components/SearchableList/SearchableList';
import SelectableListItem from '@jerecocc/tracker-ui/components/Select/SelectableListItem';
import Tag from '@jerecocc/tracker-ui/components/Tag/Tag';
import BreadcrumbContext, { type BreadcrumbConfig } from '@/context/BreadcrumbContext';
import { formatPlayerPosition } from '@/lib/playerPosition';
import { useState } from 'react';
import {
  minLogo,
  noop,
  samplePlayers,
  Stateful,
  StoryGrid,
  StoryPage,
  StoryPanel,
  StorySection,
  teams,
  vicLogo,
} from './storyData';

const meta = {
  title: 'Shared Components/Lists and Media',
  parameters: {
    docs: {
      description: {
        component: 'List rows, searchable lists, media headers, breadcrumbs, and detail fields.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const BreadcrumbTitleDemo = () => {
  const [config, setBreadcrumbs] = useState<BreadcrumbConfig | null>({
    items: [
      { label: 'Leagues', path: '/admin/leagues' },
      { label: 'PWHL', path: '/admin/leagues/pwhl' },
      { label: 'Players' },
    ],
    backPath: '/admin/leagues/pwhl',
    backLabel: 'Back to league',
  });

  return (
    <BreadcrumbContext.Provider value={{ config, setBreadcrumbs }}>
      <BreadcrumbTitleRow />
    </BreadcrumbContext.Provider>
  );
};

export const Lists = {
  render: () => (
    <StoryPage>
      <StorySection title="ListItem">
        <ul className="storybook-list">
          {samplePlayers.map((player) => (
            <ListItem
              key={player.id}
              fullWidth
              leadingImage={player.team.logo}
              leadingImagePrimaryColor={player.team.primary_color}
              leadingImageTextColor={player.team.text_color}
              imageShape="circle"
              placeholder={player.name
                .split(' ')
                .map((part) => part[0])
                .join('')}
              primaryColor={player.team.primary_color}
              textColor={player.team.text_color}
              chip={{ label: player.jersey }}
              name={player.name}
              subtitle={`${formatPlayerPosition(player.position) ?? player.position} | ${player.team.code}`}
              rightContent={{ type: 'tag', label: 'Active', intent: 'success' }}
              actions={[
                { icon: 'open_in_new', tooltip: 'Open player', onClick: noop },
                { icon: 'edit', tooltip: 'Edit player', onClick: noop },
              ]}
            />
          ))}
        </ul>
      </StorySection>
      <StorySection title="SelectableListItem">
        <ul className="storybook-list">
          <Stateful initial={['player-1']}>
            {(selected, setSelected) => (
              <>
                {samplePlayers.map((player) => (
                  <SelectableListItem
                    key={player.id}
                    checked={selected.includes(player.id)}
                    onToggle={() =>
                      setSelected(
                        selected.includes(player.id)
                          ? selected.filter((id) => id !== player.id)
                          : [...selected, player.id],
                      )
                    }
                    leadingImage={player.team.logo}
                    imageShape="circle"
                    imagePlaceholder={player.name
                      .split(' ')
                      .map((part) => part[0])
                      .join('')}
                    imagePrimaryColor={player.team.primary_color}
                    imageTextColor={player.team.text_color}
                    chip={{ label: player.jersey }}
                    name={player.name}
                    subtitle={`${formatPlayerPosition(player.position) ?? player.position} | ${player.team.code}`}
                  />
                ))}
              </>
            )}
          </Stateful>
        </ul>
      </StorySection>
    </StoryPage>
  ),
} satisfies Story;

export const SearchAndDetails = {
  render: () => (
    <StoryPage>
      <StorySection title="SearchableList">
        <SearchableList
          items={samplePlayers}
          filterItem={(player, query) => player.name.toLowerCase().includes(query.toLowerCase())}
          emptyMessage="No players available."
          renderItems={(players) => (
            <ul className="storybook-list">
              {players.map((player) => (
                <ListItem
                  key={player.id}
                  fullWidth
                  imageShape="circle"
                  placeholder={player.name
                    .split(' ')
                    .map((part) => part[0])
                    .join('')}
                  primaryColor={player.team.primary_color}
                  textColor={player.team.text_color}
                  name={player.name}
                  subtitle={formatPlayerPosition(player.position) ?? player.position}
                  rightContent={{ type: 'code', value: player.team.code }}
                />
              ))}
            </ul>
          )}
          actions={
            <Button
              icon="filter_list"
              variant="outlined"
              intent="neutral"
              onClick={noop}
            >
              Filters
            </Button>
          }
        />
      </StorySection>
      <StorySection title="InfoItem and MoreActionsMenu">
        <StoryGrid>
          <StoryPanel>
            <InfoItem
              label="Arena"
              icon="location_on"
              value="Place Bell"
            />
            <InfoItem
              label="Founded"
              type="date"
              value="2023-01-01T00:00:00Z"
            />
            <InfoItem
              label="Description"
              type="html"
              fullWidth
              value="<p>Reusable HTML content block.</p>"
            />
          </StoryPanel>
          <StoryPanel>
            <MoreActionsMenu
              items={[
                { label: 'Edit', icon: 'edit', onClick: noop },
                { label: 'Duplicate', icon: 'clone', onClick: noop },
                { label: 'Delete', icon: 'delete', intent: 'danger', onClick: noop },
              ]}
            />
            <ColorSwatch
              label="Primary"
              color={teams.montreal.primary_color}
            />
            <Tag
              label="Tracked"
              intent="success"
            />
          </StoryPanel>
        </StoryGrid>
      </StorySection>
    </StoryPage>
  ),
} satisfies Story;

export const HeadersAndBreadcrumbs = {
  render: () => (
    <StoryPage>
      <EntityHeader
        logo={vicLogo}
        name="Montreal Victoire"
        code="MTL"
        subtitle="Professional Women Hockey League"
        primaryColor={teams.montreal.primary_color}
        textColor={teams.montreal.text_color}
        nameAccessory={
          <Tag
            label="Current"
            intent="success"
          />
        }
        swatches={[
          { label: 'Primary', color: teams.montreal.primary_color },
          { label: 'Secondary', color: '#d1d5db' },
        ]}
        actions={
          <Button
            variant="outlined"
            intent="accent"
            icon="image"
            size="large"
            onClick={noop}
          >
            Logos
          </Button>
        }
        onEdit={noop}
      />
      <StoryPanel>
        <Breadcrumbs
          items={[
            { label: 'Leagues', path: '/admin/leagues' },
            { label: 'Professional Women Hockey League', shortLabel: 'PWHL', path: '/pwhl' },
            { label: 'Awards' },
          ]}
        />
        <BreadcrumbTitleDemo />
      </StoryPanel>
      <StoryPanel>
        <ListItem
          fullWidth
          image={minLogo}
          name="Minnesota Frost"
          subtitle="Media row with right-side code"
          rightContent={{ type: 'code', value: 'MIN' }}
        />
      </StoryPanel>
    </StoryPage>
  ),
} satisfies Story;
