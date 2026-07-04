import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GameAutofillManualMoveReportModal from './GameAutofillManualMoveReportModal';
import type { GameAutofillManualMoveReport } from './gameAutofillTypes';

const reports: GameAutofillManualMoveReport[] = [
  {
    leagueCode: 'PWHL',
    gameId: 'game-1',
    gameLabel: '2026-01-21 OTT @ NY',
    moves: [
      {
        playerId: '11111111-1111-4111-8111-111111111111',
        playerName: 'Emma Greco',
        leaguePlayerNumber: '118',
        jerseyNumber: 25,
        position: 'LD',
        fromTeamCode: 'VAN',
        fromTeamName: 'Vancouver Goldeneyes',
        toTeamCode: 'OTT',
        toTeamName: 'Ottawa Charge',
      },
    ],
  },
  {
    leagueCode: 'NHL',
    gameId: 'game-2',
    gameLabel: '2026-01-28 NYR @ NYI',
    moves: [],
    jerseyChanges: [
      {
        playerName: 'Player One',
        leaguePlayerNumber: '190001',
        teamCode: 'NYI',
        teamName: 'New York Islanders',
        currentJerseyNumber: 27,
        conflictingJerseyNumber: 18,
        conflictingPlayerName: 'Player Two',
        conflictingLeaguePlayerNumber: '190002',
      },
    ],
  },
];

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    value: jest.fn(),
  });
});

const renderModal = ({
  nextReports = reports,
  onClose = jest.fn(),
}: {
  nextReports?: GameAutofillManualMoveReport[];
  onClose?: () => void;
} = {}) =>
  render(
    <MemoryRouter>
      <GameAutofillManualMoveReportModal
        open
        reports={nextReports}
        onClose={onClose}
      />
    </MemoryRouter>,
  );

describe('GameAutofillManualMoveReportModal', () => {
  it('does not close when the backdrop is clicked', () => {
    const onClose = jest.fn();
    const { container } = renderModal({ onClose });

    fireEvent.click(container.firstChild as HTMLElement);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders each game report as its own accordion', () => {
    renderModal();

    expect(screen.getByText('2026-01-21 OTT @ NY')).toBeInTheDocument();
    expect(screen.getByText('2026-01-28 NYR @ NYI')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Collapse' })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'Collapse' })[0]);

    expect(screen.queryByText('Player moves')).not.toBeInTheDocument();
    expect(screen.getByText('Jersey number changes')).toBeInTheDocument();
  });

  it('links player move rows to the player details page', () => {
    renderModal({ nextReports: [reports[0]] });

    const playerLink = screen.getByRole('link', { name: /Emma Greco/ });
    const rowLinks = within(playerLink.closest('tr') as HTMLTableRowElement).getAllByRole('link');

    expect(playerLink).toHaveAttribute(
      'href',
      '/admin/leagues/pwhl/teams/van/players/11111111-1111-4111-8111-111111111111',
    );
    expect(rowLinks).toHaveLength(4);
    rowLinks.forEach((link) => {
      expect(link).toHaveAttribute(
        'href',
        '/admin/leagues/pwhl/teams/van/players/11111111-1111-4111-8111-111111111111',
      );
    });
  });

  it('renders jersey league player numbers as unlabeled subtitles', () => {
    renderModal({ nextReports: [reports[1]] });

    const table = screen.getByRole('table');
    expect(within(table).getByText('Player One')).toBeInTheDocument();
    expect(within(table).getByText('190001')).toBeInTheDocument();
    expect(within(table).getByText('Player Two')).toBeInTheDocument();
    expect(within(table).getByText('190002')).toBeInTheDocument();
    expect(screen.queryByText(/league player number 190001/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/league player number 190002/i)).not.toBeInTheDocument();
  });
});
