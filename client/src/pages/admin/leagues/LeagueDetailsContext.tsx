import type { ReactNode } from 'react';
import {
  LeagueDetailsContext,
  type LeagueDetailsContextValue,
} from './leagueDetailsState';

export const LeagueDetailsProvider = ({
  value,
  children,
}: {
  value: LeagueDetailsContextValue;
  children: ReactNode;
}) => <LeagueDetailsContext.Provider value={value}>{children}</LeagueDetailsContext.Provider>;
