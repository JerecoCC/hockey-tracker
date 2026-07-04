export interface GameAutofillProgress {
  step: string;
  message: string;
  completed?: number;
  total?: number;
  refresh?: boolean;
  leagueLabel?: string;
}

export interface GameAutofillManualPlayerMove {
  playerName: string;
  leaguePlayerNumber?: string | null;
  jerseyNumber?: number | null;
  position?: string | null;
  fromTeamCode?: string | null;
  fromTeamName?: string | null;
  toTeamCode: string;
  toTeamName?: string | null;
}

export interface GameAutofillManualMoveReport {
  leagueCode: string;
  gameId: string;
  gameLabel: string;
  gameDate?: string | null;
  moves: GameAutofillManualPlayerMove[];
}

export class ManualPlayerMovementRequiredError extends Error {
  readonly report: GameAutofillManualMoveReport;

  constructor(report: GameAutofillManualMoveReport) {
    const moveCount = report.moves.length;
    super(
      `Manual player movement required for ${report.gameLabel}: ${moveCount} ${moveCount === 1 ? 'player' : 'players'} need to be moved before this game can be auto-filled.`,
    );
    this.name = 'ManualPlayerMovementRequiredError';
    this.report = report;
  }
}

export function isManualPlayerMovementRequiredError(
  err: unknown,
): err is ManualPlayerMovementRequiredError {
  if (err instanceof ManualPlayerMovementRequiredError) return true;
  if (!(err instanceof Error) && (typeof err !== 'object' || err === null)) return false;

  const candidate = err as {
    name?: unknown;
    report?: Partial<GameAutofillManualMoveReport>;
  };
  return (
    candidate.name === 'ManualPlayerMovementRequiredError' &&
    typeof candidate.report?.leagueCode === 'string' &&
    typeof candidate.report?.gameId === 'string' &&
    typeof candidate.report?.gameLabel === 'string' &&
    Array.isArray(candidate.report?.moves)
  );
}
