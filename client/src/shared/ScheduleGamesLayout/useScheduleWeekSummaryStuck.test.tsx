import { act, renderHook } from '@testing-library/react';
import { useScheduleWeekSummaryStuck } from './useScheduleWeekSummaryStuck';

describe('useScheduleWeekSummaryStuck', () => {
  let queuedFrame: FrameRequestCallback | null;

  beforeEach(() => {
    queuedFrame = null;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 425,
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockReturnValue({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
      }),
    });
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      queuedFrame = callback;
      return 1;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.replaceChildren();
  });

  const renderStickyHook = (stickyOnMobile: boolean) => {
    const sentinel = document.createElement('div');
    document.body.appendChild(sentinel);
    jest.spyOn(sentinel, 'getBoundingClientRect').mockReturnValue({
      top: 40,
      right: 0,
      bottom: 40,
      left: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 40,
      toJSON: () => ({}),
    });

    return renderHook(() =>
      useScheduleWeekSummaryStuck({
        active: true,
        sentinelRef: { current: sentinel },
        stickyTopPx: 52,
        stickyOnMobile,
      }),
    );
  };

  it('can report the summary as stuck on mobile when enabled', () => {
    const { result } = renderStickyHook(true);

    act(() => queuedFrame?.(0));

    expect(result.current).toBe(true);
  });

  it('keeps the existing non-sticky mobile default for other consumers', () => {
    const { result } = renderStickyHook(false);

    act(() => queuedFrame?.(0));

    expect(result.current).toBe(false);
  });
});
