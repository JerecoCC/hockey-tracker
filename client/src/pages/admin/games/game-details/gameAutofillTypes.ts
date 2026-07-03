export interface GameAutofillProgress {
  step: string;
  message: string;
  completed?: number;
  total?: number;
  refresh?: boolean;
  leagueLabel?: string;
}
