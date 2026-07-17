import type { GameRecord } from '@/hooks/useGames';
import GameAutofillProviderModal, {
  type GameAutofillProvider,
} from './GameAutofillProviderModal';
import type { GameAutofillManualMoveReport, GameAutofillProgress } from './gameAutofillTypes';
import { autofillGameFromNhlGamecenter, nhlAutofillApiError } from './nhlGameAutofill';

interface Props {
  open: boolean;
  game: GameRecord;
  onClose: () => void;
  onAutofillChange?: (progress: GameAutofillProgress | null) => void;
  onManualMoveReport?: (report: GameAutofillManualMoveReport) => void;
}

const NHL_PROVIDER: GameAutofillProvider = {
  leagueLabel: 'NHL',
  formId: 'nhl-game-autofill-form',
  inputLabel: 'NHL game number',
  inputPlaceholder: 'Put game number here',
  inputRequiredMessage: 'NHL game number is required',
  statusMessage: 'Filling game from NHL GameCenter data...',
  startMessage: 'Starting NHL auto-fill...',
  failureMessage: 'Unable to auto-fill game from NHL data.',
  defaultInput: (game) => (game.game_number ? String(game.game_number) : ''),
  autofill: autofillGameFromNhlGamecenter,
  errorMessage: nhlAutofillApiError,
};

const NhlGameAutofillModal = (props: Props) => (
  <GameAutofillProviderModal
    {...props}
    provider={NHL_PROVIDER}
  />
);

export default NhlGameAutofillModal;
