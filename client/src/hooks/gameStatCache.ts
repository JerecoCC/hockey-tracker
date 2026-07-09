import type { QueryClient } from '@tanstack/react-query';

type InvalidateGameStatDependentsOptions = {
  includeGameDetails?: boolean;
  includeGameGoalieStats?: boolean;
};

export const invalidateGameStatDependents = async (
  queryClient: QueryClient,
  gameId: string,
  {
    includeGameDetails = true,
    includeGameGoalieStats = true,
  }: InvalidateGameStatDependentsOptions = {},
) => {
  const invalidations = [
    ...(includeGameGoalieStats
      ? [queryClient.invalidateQueries({ queryKey: ['game-goalie-stats', gameId] })]
      : []),
    ...(includeGameDetails
      ? [
          queryClient.invalidateQueries({ queryKey: ['games', gameId] }),
          queryClient.invalidateQueries({ queryKey: ['user-game-details', gameId] }),
        ]
      : []),
    queryClient.invalidateQueries({ queryKey: ['season-stats'] }),
    queryClient.invalidateQueries({ queryKey: ['season-standings'] }),
    queryClient.invalidateQueries({ queryKey: ['player-career-stats'] }),
    queryClient.invalidateQueries({ queryKey: ['user-player-career-stats'] }),
    queryClient.invalidateQueries({ queryKey: ['player-latest-season-stats'] }),
    queryClient.invalidateQueries({ queryKey: ['user-player-latest-season-stats'] }),
    queryClient.invalidateQueries({ queryKey: ['player-last-five-games'] }),
    queryClient.invalidateQueries({ queryKey: ['user-player-last-five-games'] }),
    queryClient.invalidateQueries({ queryKey: ['player-game-logs'] }),
    queryClient.invalidateQueries({ queryKey: ['user-player-game-logs'] }),
  ];

  await Promise.all(invalidations);
};
