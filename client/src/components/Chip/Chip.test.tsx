import { render, screen } from '@testing-library/react';
import Chip from './Chip';

describe('Chip', () => {
  it('renders medium by default', () => {
    render(<Chip>34</Chip>);

    const chip = screen.getByText('34');
    expect(chip).toHaveClass('chip');
    expect(chip).not.toHaveClass('small');
  });

  it('supports the small size', () => {
    render(<Chip size="small">1</Chip>);

    expect(screen.getByText('1')).toHaveClass('small');
  });

  it('applies branded colors when provided', () => {
    render(
      <Chip
        primaryColor="#003e7e"
        textColor="#ffffff"
      >
        91
      </Chip>,
    );

    expect(screen.getByText('91')).toHaveStyle({
      background: '#003e7e',
      borderColor: '#003e7e',
      color: '#ffffff',
    });
  });
});
