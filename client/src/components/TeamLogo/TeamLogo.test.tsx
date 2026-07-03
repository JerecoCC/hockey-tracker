import { render, screen } from '@testing-library/react';
import TeamLogo from './TeamLogo';

describe('TeamLogo wrapper clipping', () => {
  it('lets real logo shadows render outside the wrapper bounds', () => {
    render(
      <TeamLogo
        logo="https://example.com/logo.png"
        code="TOR"
        size={48}
      />,
    );

    const wrapper = screen.getByRole('img', { name: 'TOR' }).parentElement;

    expect(wrapper).toHaveStyle({
      overflow: 'visible',
      borderRadius: '0',
      background: 'none',
    });
  });

  it('keeps fallback initials inside the shaped tile', () => {
    render(
      <TeamLogo
        code="TOR"
        primaryColor="#003087"
        size={48}
      />,
    );

    const wrapper = screen.getByText('TOR').parentElement as HTMLElement;

    expect(screen.getByText('TOR')).toHaveClass('fitText', 'code');
    expect(wrapper.style.overflow).toBe('');
    expect(wrapper.style.borderRadius).toBe('');
    expect(wrapper).toHaveStyle({ background: '#003087' });
  });
});
