import { act, fireEvent, render, screen } from '@testing-library/react';
import Pagination from './Pagination';

const advancePageJumpDebounce = () => {
  act(() => {
    jest.advanceTimersByTime(500);
  });
};

describe('Pagination', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('jumps to a typed page after a debounce', () => {
    jest.useFakeTimers();
    const onPageChange = jest.fn();

    render(
      <Pagination
        page={1}
        pageSize={10}
        total={95}
        onPageChange={onPageChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Page number'), { target: { value: '6' } });
    expect(onPageChange).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(499);
    });
    expect(onPageChange).not.toHaveBeenCalled();

    advancePageJumpDebounce();
    expect(onPageChange).toHaveBeenCalledWith(6);
  });

  it('clamps debounced page jumps to the available page range', () => {
    jest.useFakeTimers();
    const onPageChange = jest.fn();

    render(
      <Pagination
        page={3}
        pageSize={10}
        total={95}
        onPageChange={onPageChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Page number'), { target: { value: '999' } });
    advancePageJumpDebounce();

    expect(onPageChange).toHaveBeenCalledWith(10);
    expect(screen.getByLabelText('Page number')).toHaveValue(10);
  });

  it('syncs the jump input when the current page changes', () => {
    const onPageChange = jest.fn();
    const { rerender } = render(
      <Pagination
        page={2}
        pageSize={10}
        total={95}
        onPageChange={onPageChange}
      />,
    );

    expect(screen.getByLabelText('Page number')).toHaveValue(2);

    rerender(
      <Pagination
        page={8}
        pageSize={10}
        total={95}
        onPageChange={onPageChange}
      />,
    );

    expect(screen.getByLabelText('Page number')).toHaveValue(8);
  });
});
