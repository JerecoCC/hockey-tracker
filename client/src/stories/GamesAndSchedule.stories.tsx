import type { Meta, StoryObj } from '@storybook/react-vite';
import CalendarGameListItem from '@/shared/CalendarGameListItem/CalendarGameListItem';
import GameCard from '@/shared/GameCard/GameCard';
import UserGameActions from '@/shared/GameCard/UserGameActions';
import MonthCalendar from '@jerecocc/tracker-ui/components/MonthCalendar/MonthCalendar';
import {
  ScheduleCalendarCard,
  ScheduleCalendarDayCount,
  ScheduleCalendarGameList,
  ScheduleCalendarLoading,
  ScheduleFilterSlot,
  ScheduleFilters,
  ScheduleGameList,
  ScheduleGameStack,
  ScheduleGamesActions,
  ScheduleGamesTitle,
  ScheduleWeekDaySkeletons,
  ScheduleWeekList,
  ScheduleWeekSummary,
  type ScheduleDayGroup,
} from '@/shared/ScheduleGamesLayout/ScheduleGamesLayout';
import TeamCalendarGameCard from '@/shared/TeamCalendarGameCard/TeamCalendarGameCard';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import Tag from '@jerecocc/tracker-ui/components/Tag/Tag';
import type { GameRecord } from '@/hooks/useGames';
import {
  noop,
  sampleGame,
  StoryGrid,
  StoryPage,
  StoryPanel,
  StorySection,
  teams,
} from './storyData';

const meta = {
  title: 'Shared Components/Games and Schedule',
  parameters: {
    docs: {
      description: {
        component: 'Game cards, calendar items, schedule layout helpers, and monthly calendar.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const calendarTeam = (team: typeof teams.montreal, score?: number) => ({
  code: team.code,
  logo: team.logo,
  primaryColor: team.primary_color,
  textColor: team.text_color,
  score,
  scoreStatus: score != null && score > 2 ? ('win' as const) : ('lose' as const),
});

const weekDays: ScheduleDayGroup<GameRecord>[] = [
  ['2026-01-12', [sampleGame]],
  ['2026-01-13', []],
  ['2026-01-14', [sampleGame, { ...sampleGame, id: 'game-2', home_team: teams.boston }]],
];

export const GameCards = {
  render: () => (
    <StoryPage>
      <StorySection title="GameCard and UserGameActions">
        <StoryGrid>
          <GameCard
            game={sampleGame}
            tzPref="ET"
            onOpen={noop}
            canOpen
            actions={
              <UserGameActions
                watched
                skipped={false}
                scheduled={false}
                busy={false}
                onView={noop}
                onDownloadScoreCard={noop}
                onMarkWatched={noop}
                onUnwatch={noop}
                onSchedule={noop}
                onSkip={noop}
              />
            }
            bottomLabel={<Tag label="Watched" intent="success" />}
          />
          <GameCard
            game={{
              ...sampleGame,
              id: 'game-live',
              status: 'in_progress',
              watched_by_user: false,
              home_score: 1,
              away_score: 1,
            }}
            tzPref="local"
            onOpen={noop}
            canOpen
            useLeagueColors
            bottomLabel="Live tracking"
          />
        </StoryGrid>
      </StorySection>

      <StorySection title="GameCard — list-item variant">
        <ul className="storybook-list">
          <GameCard
            variant="list-item"
            game={{
              ...sampleGame,
              away_team: { ...sampleGame.away_team, ...teams.minnesota },
              home_team: { ...sampleGame.home_team, ...teams.montreal },
              away_score: 2,
              home_score: 4,
              venue: 'Place Bell',
              game_number: 32,
            }}
            showScore
            statusLabel="Final"
            statusIntent="success"
            originalDateLabel="Jan 18, 2026"
            timeLabel="7:00 PM"
            actions={[{ icon: 'edit', tooltip: 'Edit game', onClick: noop }]}
          />
        </ul>
      </StorySection>

      <StorySection title="CalendarGameListItem and TeamCalendarGameCard">
        <StoryGrid>
          <CalendarGameListItem
            awayTeam={calendarTeam(teams.minnesota, 2)}
            homeTeam={calendarTeam(teams.montreal, 4)}
            showScore
            topLabel="7:00 PM"
            centerLabel="FINAL"
            bottomLabel="Game 32"
            tooltip="Minnesota at Montreal"
          />
          <TeamCalendarGameCard
            variant="home"
            opponent={teams.boston}
            detail="4-2 W"
            topLabel="Home"
            homePrimaryColor={teams.montreal.primary_color}
            ariaLabel="Open Boston game"
            onOpen={noop}
          />
        </StoryGrid>
      </StorySection>
    </StoryPage>
  ),
} satisfies Story;

export const CalendarAndSchedule = {
  render: () => (
    <StoryPage>
      <StorySection title="MonthCalendar">
        <ScheduleCalendarCard>
          <MonthCalendar
            month={new Date(2026, 0, 1)}
            getDayHeaderRight={({ day }) =>
              day === 18 ? <ScheduleCalendarDayCount count={1} /> : null
            }
            renderDayContent={({ day }) =>
              day === 18 ? (
                <ScheduleCalendarGameList>
                  <CalendarGameListItem
                    awayTeam={calendarTeam(teams.minnesota, 2)}
                    homeTeam={calendarTeam(teams.montreal, 4)}
                    showScore
                    centerLabel="FINAL"
                  />
                </ScheduleCalendarGameList>
              ) : null
            }
          />
        </ScheduleCalendarCard>
      </StorySection>

      <StorySection title="Schedule helpers">
        <StoryPanel>
          <ScheduleGamesActions>
            <ScheduleGamesTitle
              title="Games"
              picker={<Tag label="Jan 12 - Jan 18" />}
            />
            <Button
              icon="download"
              onClick={noop}
            >
              Export
            </Button>
          </ScheduleGamesActions>
          <ScheduleFilters visible>
            <ScheduleFilterSlot>
              <Tag label="Team: MTL" intent="info" />
            </ScheduleFilterSlot>
            <ScheduleFilterSlot wide>
              <Tag label="Status: Final" intent="success" />
            </ScheduleFilterSlot>
          </ScheduleFilters>
          <ScheduleWeekSummary
            days={weekDays}
            loading={false}
            activeDateKey="2026-01-12"
            onSelectDate={noop}
            formatDate={(dateKey) => dateKey.slice(5)}
            formatWeekday={(dateKey) => new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}
            formatHeading={(dateKey) => dateKey}
          />
          <ScheduleWeekList
            days={weekDays}
            formatHeading={(dateKey) => dateKey}
            renderDayContent={(_, games) => (
              <ScheduleGameList>
                {games.map((game) => (
                  <GameCard
                    key={game.id}
                    variant="list-item"
                    game={game}
                    showScore
                    statusLabel="Final"
                    statusIntent="success"
                  />
                ))}
              </ScheduleGameList>
            )}
          />
        </StoryPanel>
      </StorySection>
    </StoryPage>
  ),
} satisfies Story;

export const LoadingSchedule = {
  render: () => (
    <StoryGrid>
      <StoryPanel>
        <ScheduleWeekDaySkeletons dateLabel="Jan 18" />
      </StoryPanel>
      <StoryPanel>
        <ScheduleCalendarLoading month={new Date(2026, 0, 1)} />
      </StoryPanel>
      <StoryPanel>
        <ScheduleGameStack>
          <TeamCalendarGameCard
            variant="away"
            opponent={teams.toronto}
            detail="Scheduled"
            topLabel="Away"
            ariaLabel="Open Toronto game"
            onOpen={noop}
          />
        </ScheduleGameStack>
      </StoryPanel>
    </StoryGrid>
  ),
} satisfies Story;
