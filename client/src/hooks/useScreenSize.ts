import { useEffect, useState } from 'react';
import { getScreenSize, type ScreenSize } from '@/lib/screenSize';

const readScreenSize = (): ScreenSize =>
  typeof window === 'undefined' ? 'desktop' : getScreenSize(window.innerWidth);

/** The app's current screen size (mobile, tablet or desktop), kept up to date on resize. */
const useScreenSize = () => {
  const [screenSize, setScreenSize] = useState<ScreenSize>(readScreenSize);

  useEffect(() => {
    const update = () => setScreenSize(readScreenSize());
    window.addEventListener('resize', update, { passive: true });
    update();
    return () => window.removeEventListener('resize', update);
  }, []);

  return screenSize;
};

export default useScreenSize;
