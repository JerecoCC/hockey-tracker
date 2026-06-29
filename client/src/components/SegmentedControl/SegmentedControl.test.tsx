import { fireEvent, render, screen } from '@testing-library/react';
import SegmentedControl from './SegmentedControl';

const options = [
  { value: 'summary', label: 'Summary' },
  { value: 'forwards', label: 'Forwards' },
  { value: 'defense', label: 'Defense' },
];

describe('SegmentedControl', () => {
  it('renders vertical dividers between options', () => {
    const { container } = render(
      <SegmentedControl
        value="summary"
        onChange={jest.fn()}
        options={options}
      />,
    );

    const dividers = container.querySelectorAll('.divider.vertical');
    expect(dividers).toHaveLength(2);
  });

  it('calls onChange when an option is clicked', () => {
    const onChange = jest.fn();
    render(
      <SegmentedControl
        value="summary"
        onChange={onChange}
        options={options}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Forwards' }));

    expect(onChange).toHaveBeenCalledWith('forwards');
  });
});
