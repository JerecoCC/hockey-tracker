import { useState } from 'react';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import InfoItem from '@/components/InfoItem/InfoItem';
import type { GameRecord, UpdateGameInfoData } from '@/hooks/useGames';
import GameInfoEditModal from '../GameInfoEditModal';
import { GAME_TYPE_LABEL } from '../constants';
import {
  DATE_FMT_SHORT,
  TIME_FMT,
  formatEndTime,
  formatEndTimeLocal,
  formatScheduledDateLocal,
  formatScheduledTime,
  formatScheduledTimeLocal,
  formatTimestampTimeLocal,
} from '../formatUtils';
import styles from './GameInfoCard.module.scss';

interface Props {
  game: GameRecord;
  busy: string | null;
  updateGameInfo?: (data: UpdateGameInfoData) => Promise<boolean>;
  useLocalTimezone?: boolean;
}

const GameInfoCard = ({ game, busy, updateGameInfo, useLocalTimezone = false }: Props) => {
  const [editOpen, setEditOpen] = useState(false);
  const playoffRoundLabel =
    game.playoff_round != null
      ? (game.playoff_round_names?.[game.playoff_round] ?? `Round ${game.playoff_round}`)
      : null;

  return (
    <>
      <Card
        title="Game Info"
        action={
          updateGameInfo ? (
            <Button
              variant="outlined"
              intent="neutral"
              icon="edit"
              size="sm"
              tooltip="Edit game info"
              onClick={() => setEditOpen(true)}
            />
          ) : undefined
        }
      >
        <div className={styles.infoGrid}>
          <InfoItem
            label="Type"
            data={GAME_TYPE_LABEL[game.game_type]}
            full
          />
          {playoffRoundLabel && (
            <InfoItem
              label="Round"
              data={playoffRoundLabel}
            />
          )}
          {game.game_number_in_series != null && (
            <InfoItem
              label="Game in Series"
              data={String(game.game_number_in_series)}
            />
          )}
          <InfoItem
            label="Scheduled Date"
            data={
              useLocalTimezone
                ? formatScheduledDateLocal(game.scheduled_at, game.scheduled_time)
                : game.scheduled_at
                  ? DATE_FMT_SHORT.format(new Date(game.scheduled_at))
                  : null
            }
          />
          <InfoItem
            label="Scheduled Time"
            data={
              useLocalTimezone
                ? formatScheduledTimeLocal(game.scheduled_time, game.scheduled_at)
                : game.scheduled_time
                ? formatScheduledTime(game.scheduled_time, game.scheduled_at)
                : null
            }
          />
          {game.status !== 'cancelled' && game.status !== 'scheduled' && (
            <>
              <InfoItem
                label="Start Time"
                data={
                  useLocalTimezone
                    ? formatTimestampTimeLocal(game.time_start)
                    : game.time_start
                      ? TIME_FMT.format(new Date(game.time_start))
                      : null
                }
              />
              <InfoItem
                label="End Time"
                data={
                  game.time_end
                    ? useLocalTimezone
                      ? formatEndTimeLocal(game.time_end, game.time_start)
                      : formatEndTime(game.time_end, game.time_start)
                    : null
                }
              />
            </>
          )}
          <InfoItem
            label="Venue"
            data={game.venue ?? null}
            full
          />
          {game.notes && (
            <InfoItem
              label="Notes"
              data={game.notes}
              full
            />
          )}
        </div>
      </Card>

      <GameInfoEditModal
        open={editOpen}
        game={game}
        isSaving={busy === 'update-info'}
        disabled={!!busy}
        onClose={() => setEditOpen(false)}
        onSave={updateGameInfo}
      />
    </>
  );
};

export default GameInfoCard;
