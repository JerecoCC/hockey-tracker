import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Accordion from './Accordion';

describe('Accordion', () => {
  it('toggles open and closed when clicking the header label', async () => {
    const user = userEvent.setup();

    render(
      <Accordion label="Season Stats">
        <div>Regular season table</div>
      </Accordion>,
    );

    expect(screen.getByText('Regular season table')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await user.click(screen.getByText('Season Stats'));

    expect(screen.queryByText('Regular season table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    await user.click(screen.getByText('Season Stats'));

    expect(screen.getByText('Regular season table')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('does not toggle when clicking hover actions in the header', async () => {
    const user = userEvent.setup();
    const handleEdit = jest.fn();

    render(
      <Accordion
        label="Awards"
        hoverActions={[{ label: 'Edit', icon: 'edit', onClick: handleEdit }]}
      >
        <div>Award history</div>
      </Accordion>,
    );

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(handleEdit).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Award history')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});
