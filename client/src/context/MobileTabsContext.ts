import { createContext, useContext } from 'react';

export interface MobileTabsState {
  /** Label for each tab button. */
  tabs: string[];
  /** Optional icon name (from Icon component) for each tab button. */
  icons: (string | undefined)[];
  /** Currently active tab index. */
  activeIndex: number;
  /** Called when the user taps a tab in the header strip. */
  onChange: (index: number) => void;
}

interface MobileTabsContextValue {
  mobileTabs: MobileTabsState | null;
  setMobileTabs: (state: MobileTabsState | null) => void;
}

const MobileTabsContext = createContext<MobileTabsContextValue>({
  mobileTabs: null,
  setMobileTabs: () => {},
});

export const useMobileTabs = () => useContext(MobileTabsContext);

export default MobileTabsContext;
