import { act, render, screen } from '@testing-library/react';
import StickyHeroCard from './StickyHeroCard';

const originalInnerWidth = window.innerWidth;

describe('StickyHeroCard', () => {
  let rectTop = 80;
  let getBoundingClientRectSpy: jest.SpyInstance;

  beforeEach(() => {
    rectTop = 80;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1024,
    });
    getBoundingClientRectSpy = jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(
        () =>
          ({
            top: rectTop,
            bottom: rectTop + 100,
            left: 0,
            right: 100,
            width: 100,
            height: 100,
            x: 0,
            y: rectTop,
            toJSON: () => {},
          }) as DOMRect,
      );
  });

  afterEach(() => {
    getBoundingClientRectSpy.mockRestore();
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    });
  });

  it('applies the stuck class when the card reaches the sticky top', () => {
    render(
      <StickyHeroCard
        data-testid="sticky-card"
        stuckClassName="is-stuck"
        stickyTopPx={52}
      >
        Content
      </StickyHeroCard>,
    );

    expect(screen.getByTestId('sticky-card')).not.toHaveClass('is-stuck');

    rectTop = 52;
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(screen.getByTestId('sticky-card')).toHaveClass('is-stuck');
  });

  it('passes stuck state to render-prop children', () => {
    render(
      <StickyHeroCard stickyTopPx={52}>
        {({ isStuck }) => <span>{isStuck ? 'stuck' : 'normal'}</span>}
      </StickyHeroCard>,
    );

    expect(screen.getByText('normal')).toBeInTheDocument();

    rectTop = 40;
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(screen.getByText('stuck')).toBeInTheDocument();
  });
});
