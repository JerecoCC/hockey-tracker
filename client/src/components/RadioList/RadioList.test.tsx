import { fireEvent, render, screen } from '@testing-library/react';
import RadioList, { type RadioListOption } from './RadioList';

const options: RadioListOption[] = [
  {
    value: 'home',
    name: 'Home',
    subtitle: 'Home starter',
    imagePlaceholder: 'H',
  },
  {
    value: 'away',
    name: 'Away',
    subtitle: 'Away starter',
    imagePlaceholder: 'A',
  },
  {
    value: 'scratch',
    name: 'Scratch',
    disabled: true,
    imagePlaceholder: 'S',
  },
];

describe('RadioList', () => {
  it('renders a vertical radio group with the selected option checked', () => {
    render(
      <RadioList
        ariaLabel="Goalie choices"
        value="home"
        onChange={jest.fn()}
        options={options}
      />,
    );

    expect(screen.getByRole('radiogroup', { name: 'Goalie choices' })).toHaveAttribute(
      'aria-orientation',
      'vertical',
    );
    expect(screen.getByRole('radio', { name: 'Home' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Away' })).toHaveAttribute('aria-checked', 'false');
  });

  it('renders dividers between options', () => {
    const { container } = render(
      <RadioList
        value="home"
        onChange={jest.fn()}
        options={options}
      />,
    );

    expect(container.querySelectorAll('.divider.horizontal')).toHaveLength(options.length - 1);
  });

  it('preserves option order regardless of selected value', () => {
    render(
      <RadioList
        value="away"
        onChange={jest.fn()}
        options={options}
      />,
    );

    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAccessibleName('Home');
    expect(radios[1]).toHaveAccessibleName('Away');
    expect(radios[2]).toHaveAccessibleName('Scratch');
  });

  it('calls onChange with the clicked option value', () => {
    const onChange = jest.fn();
    render(
      <RadioList
        value="home"
        onChange={onChange}
        options={options}
      />,
    );

    fireEvent.click(screen.getByText('Away'));

    expect(onChange).toHaveBeenCalledWith('away');
  });

  it('does not toggle the selected option off', () => {
    const onChange = jest.fn();
    render(
      <RadioList
        value="home"
        onChange={onChange}
        options={options}
      />,
    );

    fireEvent.click(screen.getByText('Home'));
    fireEvent.click(screen.getByRole('radio', { name: 'Home' }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not select disabled options', () => {
    const onChange = jest.fn();
    render(
      <RadioList
        value="home"
        onChange={onChange}
        options={options}
      />,
    );

    fireEvent.click(screen.getByText('Scratch'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not select options when the list is disabled', () => {
    const onChange = jest.fn();
    render(
      <RadioList
        value="home"
        onChange={onChange}
        options={options}
        disabled
      />,
    );

    fireEvent.click(screen.getByText('Away'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
