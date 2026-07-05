import { fireEvent, render, screen } from '@testing-library/react';
import Banner from './Banner';

describe('Banner', () => {
  it('renders a decorative icon, title, message, and close button', () => {
    const onClose = jest.fn();
    const { container } = render(
      <Banner
        intent="warning"
        icon="info"
        title="Heads up"
        onClose={onClose}
      >
        This needs attention.
      </Banner>,
    );

    expect(screen.getByText('Heads up')).toBeInTheDocument();
    expect(screen.getByText('This needs attention.')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(container.querySelector('.warning')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss banner' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('allows the title to be omitted', () => {
    render(
      <Banner
        icon="info"
        onClose={jest.fn()}
      >
        Message only.
      </Banner>,
    );

    expect(screen.getByText('Message only.')).toBeInTheDocument();
  });
});
