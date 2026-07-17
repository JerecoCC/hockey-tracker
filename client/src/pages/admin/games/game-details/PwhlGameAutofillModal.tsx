import type { GameRecord } from '@/hooks/useGames';
import GameAutofillProviderModal, {
  type GameAutofillProvider,
} from './GameAutofillProviderModal';
import type { GameAutofillManualMoveReport, GameAutofillProgress } from './gameAutofillTypes';
import { autofillGameFromPwhlGamecenter, pwhlAutofillApiError } from './pwhlGameAutofill';

interface Props {
  open: boolean;
  game: GameRecord;
  onClose: () => void;
  onAutofillChange?: (progress: GameAutofillProgress | null) => void;
  onManualMoveReport?: (report: GameAutofillManualMoveReport) => void;
}

const PWHL_PROVIDER: GameAutofillProvider = {
  leagueLabel: 'PWHL',
  formId: 'pwhl-game-autofill-form',
  inputLabel: 'PWHL game ID',
  inputPlaceholder: 'Put game ID here',
  inputRequiredMessage: 'PWHL game ID is required',
  statusMessage: 'Filling game from PWHL HockeyTech data...',
  startMessage: 'Starting PWHL auto-fill...',
  failureMessage: 'Unable to auto-fill game from PWHL data.',
  defaultInput: (game) =>
    game.league_game_number ?? (game.game_number ? String(game.game_number) : ''),
  autofill: autofillGameFromPwhlGamecenter,
  errorMessage: pwhlAutofillApiError,
  normalizeProgress: (progress) => ({ leagueLabel: 'PWHL', ...progress }),
  startProgress: {
    step: 'start',
    message: 'Starting PWHL auto-fill...',
    leagueLabel: 'PWHL',
  },
};

const PwhlGameAutofillModal = (props: Props) => (
  <GameAutofillProviderModal
    {...props}
    provider={PWHL_PROVIDER}
  />
);

export default PwhlGameAutofillModal;
