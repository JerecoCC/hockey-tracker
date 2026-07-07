import { fireEvent, render, screen } from '@testing-library/react';
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

  it('renders a provided NHL season mug', () => {
    const { container } = render(
      <PlayerAvatar
        photo="https://assets.nhle.com/mugs/nhl/20242025/EDM/8478402.png"
        initials="MC"
        size={48}
      />,
    );

    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://assets.nhle.com/mugs/nhl/20242025/EDM/8478402.png',
    );
  });

  it('falls back to the latest NHL mug when a season mug fails', () => {
    const { container } = render(
      <PlayerAvatar
        photo="https://assets.nhle.com/mugs/nhl/20242025/EDM/8478402.png"
        initials="MC"
        size={48}
      />,
    );

    const image = container.querySelector('img');
    if (!image) throw new Error('Expected NHL mug image to render');
    fireEvent.error(image);

    expect(image).toHaveAttribute(
      'src',
      'https://assets.nhle.com/mugs/nhl/latest/8478402.png',
    );
  });

  it('uses an explicit fallback photo when provided', () => {
    const { container } = render(
      <PlayerAvatar
        photo="https://example.com/stored.png"
        fallbackPhoto="https://example.com/fallback.png"
        initials="MC"
        size={48}
      />,
    );

    const image = container.querySelector('img');
    if (!image) throw new Error('Expected provided image to render');
    fireEvent.error(image);

    expect(image).toHaveAttribute('src', 'https://example.com/fallback.png');
  });
});
