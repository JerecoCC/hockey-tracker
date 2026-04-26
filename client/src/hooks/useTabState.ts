import { useState } from 'react';

function readFromStorage(key: string, defaultIndex: number): number {
  try {
    const stored = sessionStorage.getItem(key);
    if (stored !== null) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) return parsed;
    }
  } catch {
    // sessionStorage unavailable (e.g. private browsing restrictions)
  }
  return defaultIndex;
}

function writeToStorage(key: string, index: number): void {
  try {
    sessionStorage.setItem(key, String(index));
  } catch {
    // sessionStorage unavailable
  }
}

/**
 * Persists the active tab index in sessionStorage so the last-selected tab
 * is restored when the user navigates back to the same page within the session.
 *
 * @param key          Unique sessionStorage key (e.g. `'tab:league-details'`).
 * @param defaultIndex Fallback index when no value is stored (defaults to 0).
 * @returns            `[activeIndex, handleChange]` to pass to `<Tabs>`.
 */
function useTabState(key: string, defaultIndex = 0): [number, (i: number) => void] {
  const [activeTab, setActiveTab] = useState<number>(() =>
    readFromStorage(key, defaultIndex),
  );

  const handleChange = (i: number) => {
    writeToStorage(key, i);
    setActiveTab(i);
  };

  return [activeTab, handleChange];
}

export default useTabState;
