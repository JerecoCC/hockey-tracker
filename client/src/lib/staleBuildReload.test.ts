import { installStaleBuildReload } from './staleBuildReload';

const firePreloadError = () => {
  const event = new Event('vite:preloadError', { cancelable: true });
  window.dispatchEvent(event);
  return event;
};

describe('installStaleBuildReload', () => {
  let uninstall: () => void = () => {};

  beforeEach(() => sessionStorage.clear());
  afterEach(() => uninstall());

  it('reloads once when a lazy-loaded chunk fails, instead of surfacing the error', () => {
    const reload = jest.fn();
    uninstall = installStaleBuildReload(reload, () => 1_000_000);

    const event = firePreloadError();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('lets the error through when it fails again right after reloading', () => {
    const reload = jest.fn();
    let time = 1_000_000;
    uninstall = installStaleBuildReload(reload, () => time);

    firePreloadError();
    time += 5_000;
    const second = firePreloadError();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(second.defaultPrevented).toBe(false);
  });

  it('reloads again once the guard has passed', () => {
    const reload = jest.fn();
    let time = 1_000_000;
    uninstall = installStaleBuildReload(reload, () => time);

    firePreloadError();
    time += 60_000;
    firePreloadError();

    expect(reload).toHaveBeenCalledTimes(2);
  });
});
