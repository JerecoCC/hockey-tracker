import { render, screen } from '@testing-library/react';
import PlayerAvatar from './PlayerAvatar';

describe('PlayerAvatar', () => {
  it('renders fallback initials with fitting text', () => {
    render(
      <PlayerAvatar
        initials="AB"
        size={48}
      />,
    );

    expect(screen.getByText('AB')).toHaveClass('fitText', 'initials');
  });
});
