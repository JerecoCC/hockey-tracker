import { fireEvent, render, screen } from '@testing-library/react';
import type { GameRecord } from '@/hooks/useGames';
import ScheduleWatchModal from './ScheduleWatchModal';

jest.mock(
  '@jerecocc/tracker-ui/components/DatePicker/DatePicker',
  () =>
    ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
      <input
        aria-label="Watch date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    ),
);

// A date-only game on Oct 10, 2026.
const game = {
  id: 'game-1',
  scheduled_at: '2026-10-10',
  scheduled_time: null,
  away_team: { code: 'AWY' },
  home_team: { code: 'HOM' },
} as unknown as GameRecord;

const renderModal = (value: string) => {
  const onChange = jest.fn();
  render(
    <ScheduleWatchModal
      open
      game={game}
      value={value}
      busy={false}
      onChange={onChange}
      onClose={jest.fn()}
      onSave={jest.fn()}
    />,
  );
  return { onChange, input: screen.getByLabelText('Watch date') as HTMLInputElement };
};

describe('ScheduleWatchModal', () => {
  it('starts on the game date when the watch is not postponed', () => {
    const { input } = renderModal('');

    expect(input.value).toBe('2026-10-10');
    expect(screen.queryByText('Choose a watch date after the game date.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
  });

  it('starts on the postponed date when the watch is postponed', () => {
    const { input } = renderModal('2026-10-14');

    expect(input.value).toBe('2026-10-14');
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
  });

  it('reports the game date as no postponement', () => {
    const { input, onChange } = renderModal('2026-10-14');

    fireEvent.change(input, { target: { value: '2026-10-10' } });

    expect(onChange).toHaveBeenLastCalledWith('');
    expect(screen.queryByText('Choose a watch date after the game date.')).not.toBeInTheDocument();
  });

  it('resets to the game date', () => {
    const { input, onChange } = renderModal('2026-10-14');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(input.value).toBe('2026-10-10');
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('still rejects dates before the game', () => {
    const { input } = renderModal('');

    fireEvent.change(input, { target: { value: '2026-10-08' } });

    expect(screen.getByText('Choose a watch date after the game date.')).toBeInTheDocument();
  });
});
