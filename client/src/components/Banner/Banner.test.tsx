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

  it('can render without a close control', () => {
    render(
      <Banner
        icon="info"
        closeable={false}
      >
        Passive message.
      </Banner>,
    );

    expect(screen.getByText('Passive message.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders actions without requiring a close control', () => {
    render(
      <Banner
        icon="info"
        actions={<button type="button">Continue</button>}
      >
        Action message.
      </Banner>,
    );

    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('adds a cancel action when an action banner is closeable', () => {
    const onClose = jest.fn();
    render(
      <Banner
        icon="info"
        actions={<button type="button">Continue</button>}
        onClose={onClose}
      >
        Action message.
      </Banner>,
    );

    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
