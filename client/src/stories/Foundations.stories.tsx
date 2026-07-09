import type { Meta, StoryObj } from '@storybook/react-vite';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import ColorSwatch from '@jerecocc/tracker-ui/components/ColorSwatch/ColorSwatch';
import GoogleButton from '@/shared/GoogleButton/GoogleButton';
import GroupTeamCount from '@jerecocc/tracker-ui/components/GroupTeamCount/GroupTeamCount';
import Icon from '@jerecocc/tracker-ui/components/Icon/Icon';
import InfoTooltip from '@jerecocc/tracker-ui/components/InfoTooltip/InfoTooltip';
import LoadingSpinner from '@jerecocc/tracker-ui/components/LoadingSpinner/LoadingSpinner';
import PlayerAvatar from '@jerecocc/tracker-ui/components/PlayerAvatar/PlayerAvatar';
import Skeleton, { type SkeletonType } from '@jerecocc/tracker-ui/components/Skeleton/Skeleton';
import Tag, { type TagIntent } from '@jerecocc/tracker-ui/components/Tag/Tag';
import TeamLogo from '@jerecocc/tracker-ui/components/TeamLogo/TeamLogo';
import ToggleButton from '@jerecocc/tracker-ui/components/ToggleButton/ToggleButton';
import Tooltip from '@jerecocc/tracker-ui/components/Tooltip/Tooltip';
import {
  bosLogo,
  minLogo,
  noop,
  Stateful,
  StoryGrid,
  StoryPage,
  StoryPanel,
  StorySection,
  teams,
  vicLogo,
} from './storyData';

const meta = {
  title: 'Shared Components/Foundations',
  parameters: {
    docs: {
      description: {
        component: 'Primitive controls, status indicators, icons, badges, and visual tokens.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const buttonIntents = ['accent', 'neutral', 'success', 'warning', 'danger', 'info'] as const;
const tagIntents: TagIntent[] = ['neutral', 'accent', 'info', 'success', 'warning', 'danger'];
const skeletonTypes: SkeletonType[] = [
  'title',
  'text',
  'subtitle',
  'tag',
  'avatar',
  'picture',
  'card',
  'block',
];

export const ControlsAndStatus = {
  render: () => (
    <StoryPage>
      <StorySection title="Button">
        <StoryPanel>
          <div className="storybook-row">
            {buttonIntents.map((intent) => (
              <Button
                key={intent}
                intent={intent}
                icon={intent === 'danger' ? 'delete' : 'add'}
                onClick={noop}
              >
                {intent}
              </Button>
            ))}
          </div>
          <div className="storybook-row">
            <Button
              variant="outlined"
              intent="accent"
              icon="edit"
              onClick={noop}
            >
              Outlined
            </Button>
            <Button
              variant="ghost"
              intent="neutral"
              icon="more_vert"
              onClick={noop}
            >
              Ghost
            </Button>
            <Button
              icon="save"
              onClick={noop}
            >
              Default
            </Button>
            <Button
              icon="download"
              iconHeight="field"
              tooltip="Icon-only button"
              aria-label="Download"
              onClick={noop}
            />
          </div>
        </StoryPanel>
      </StorySection>

      <StorySection title="ToggleButton">
        <StoryGrid>
          <StoryPanel>
            <Stateful initial={true}>
              {(active, setActive) => (
                <div className="storybook-row">
                  <ToggleButton
                    active={active}
                    onClick={() => setActive(!active)}
                    icon="filter_list"
                    activeTooltip="Hide filters"
                    inactiveTooltip="Show filters"
                  >
                    Filters
                  </ToggleButton>
                  <ToggleButton
                    active={active}
                    onClick={() => setActive(!active)}
                    variant="switch"
                    activeIcon="check"
                    inactiveIcon="close"
                  />
                </div>
              )}
            </Stateful>
          </StoryPanel>
        </StoryGrid>
      </StorySection>

      <StorySection title="Tags, icons, tooltips">
        <StoryPanel>
          <div className="storybook-row">
            {tagIntents.map((intent) => (
              <Tag
                key={intent}
                label={intent}
                intent={intent}
                icon={intent === 'success' ? 'check_circle' : undefined}
              />
            ))}
            <Tooltip text="A plain tooltip">
              <Button
                variant="outlined"
                intent="neutral"
                icon="info"
                onClick={noop}
              >
                Hover
              </Button>
            </Tooltip>
            <InfoTooltip text="Reusable info tooltip used after compact labels." />
          </div>
          <div className="storybook-row">
            {['sports_hockey', 'emoji_events', 'calendar_month', 'groups', 'query_stats'].map(
              (name) => (
                <Icon
                  key={name}
                  name={name}
                  size="1.4rem"
                />
              ),
            )}
          </div>
        </StoryPanel>
      </StorySection>

      <StorySection title="Logos and avatars">
        <StoryGrid>
          <StoryPanel>
            <div className="storybook-row">
              <TeamLogo
                logo={vicLogo}
                code="MTL"
                size={64}
                primaryColor={teams.montreal.primary_color}
                textColor={teams.montreal.text_color}
              />
              <TeamLogo
                code="BOS"
                size={64}
                primaryColor={teams.boston.primary_color}
                textColor={teams.boston.text_color}
                shape="circle"
              />
              <PlayerAvatar
                initials="TH"
                primaryColor={teams.minnesota.primary_color}
                textColor={teams.minnesota.text_color}
                size={64}
              />
            </div>
          </StoryPanel>
          <StoryPanel>
            <ColorSwatch
              label="Primary"
              color={teams.montreal.primary_color}
            />
            <ColorSwatch
              label="Secondary"
              color="#d1d5db"
            />
            <GroupTeamCount count={8} />
          </StoryPanel>
        </StoryGrid>
      </StorySection>

      <StorySection title="Skeleton and loading states">
        <StoryGrid>
          <StoryPanel>
            {skeletonTypes.map((type) => (
              <Skeleton
                key={type}
                type={type}
                width={type === 'avatar' ? 48 : '100%'}
                height={type === 'block' ? 56 : undefined}
              />
            ))}
          </StoryPanel>
          <StoryPanel>
            <LoadingSpinner
              layout="inline"
              size="sm"
              message="Inline loading"
            />
            <LoadingSpinner
              layout="block"
              message="Loading shared components..."
            />
          </StoryPanel>
        </StoryGrid>
      </StorySection>

      <StorySection title="Auth button">
        <StoryPanel>
          <GoogleButton />
        </StoryPanel>
      </StorySection>
    </StoryPage>
  ),
} satisfies Story;

export const LogoOnly = {
  render: () => (
    <StoryPanel>
      <div className="storybook-row">
        <TeamLogo
          logo={minLogo}
          code="MIN"
          size={96}
          primaryColor={teams.minnesota.primary_color}
          textColor={teams.minnesota.text_color}
        />
        <TeamLogo
          logo={bosLogo}
          code="BOS"
          size={96}
          primaryColor={teams.boston.primary_color}
          textColor={teams.boston.text_color}
        />
      </div>
    </StoryPanel>
  ),
} satisfies Story;
