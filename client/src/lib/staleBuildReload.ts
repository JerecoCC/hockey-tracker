const RELOAD_AT_STORAGE_KEY = 'stale-build-reload-at';
// A second failure this soon after reloading means the chunk is genuinely broken, not stale.
const RELOAD_GUARD_MS = 10_000;

const readLastReload = () => {
  try {
    return Number(sessionStorage.getItem(RELOAD_AT_STORAGE_KEY) ?? 0);
  } catch {
    return 0;
  }
};

const writeLastReload = (time: number) => {
  try {
    sessionStorage.setItem(RELOAD_AT_STORAGE_KEY, String(time));
  } catch {
    // sessionStorage unavailable; the reload still happens, just without the loop guard.
  }
};

/**
 * Reloads the page when a lazy-loaded chunk fails to load. Each deploy replaces the hashed
 * chunks, so a tab left open from before it (a phone coming back to the browser, say) asks for
 * chunks that no longer exist. A reload fetches the current index.html and its chunks.
 */
export const installStaleBuildReload = (
  reload: () => void = () => window.location.reload(),
  now: () => number = Date.now,
) => {
  const handlePreloadError = (event: Event) => {
    if (now() - readLastReload() < RELOAD_GUARD_MS) return;
    event.preventDefault();
    writeLastReload(now());
    reload();
  };

  window.addEventListener('vite:preloadError', handlePreloadError);
  return () => window.removeEventListener('vite:preloadError', handlePreloadError);
};
