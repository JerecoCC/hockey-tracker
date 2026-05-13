import { createContext, useContext } from 'react';

/**
 * Provides the DOM node that ScoreboardCard portals into.
 * AdminLayout / UserLayout set this via a state ref-callback on the slot div
 * that lives directly inside .scrollArea (outside <main>).
 * ScoreboardCard reads it to portal outside the max-width-constrained <main>.
 */
const ScoreboardPortalContext = createContext<HTMLDivElement | null>(null);

export const useScoreboardPortalContainer = () => useContext(ScoreboardPortalContext);

export default ScoreboardPortalContext;
