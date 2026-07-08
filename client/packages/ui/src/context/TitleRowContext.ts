import { createContext, useContext } from 'react';

/**
 * Provides the DOM node that TitleRow portals into.
 * Layouts provide a desktop row container plus an optional mobile header-left slot.
 */
export interface TitleRowPortalTargets {
  rowContainer: HTMLDivElement | null;
  mobileLeftContainer: HTMLDivElement | null;
}

const TitleRowContext = createContext<TitleRowPortalTargets>({
  rowContainer: null,
  mobileLeftContainer: null,
});

export const useTitleRowContainer = () => useContext(TitleRowContext);

export default TitleRowContext;
