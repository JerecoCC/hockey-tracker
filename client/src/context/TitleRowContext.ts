import { createContext, useContext } from 'react';

/**
 * Provides the DOM node that TitleRow portals into.
 * AdminLayout sets this via a state ref callback; TitleRow reads it to portal.
 */
const TitleRowContext = createContext<HTMLDivElement | null>(null);

export const useTitleRowContainer = () => useContext(TitleRowContext);

export default TitleRowContext;
