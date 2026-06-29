import { render, screen } from '@testing-library/react';
import AddRowBar from './AddRowBar';

describe('AddRowBar', () => {
  it('renders a divider above the row actions', () => {
    const { container } = render(
      <AddRowBar
        label="Add row"
        onClick={jest.fn()}
      />,
    );

    expect(container.querySelector('.divider.horizontal')).toBeInTheDocument();
  });

  it('renders the add action label', () => {
    render(
      <AddRowBar
        label="Add row"
        onClick={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /add row/i })).toBeInTheDocument();
  });
});
