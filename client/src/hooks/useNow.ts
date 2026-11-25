import { useEffect, useState } from 'react';

/** The current time, refreshed every `intervalMs` so time-based UI updates on its own. */
const useNow = (intervalMs = 60_000) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
};

export default useNow;
