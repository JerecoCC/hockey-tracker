import { useState } from 'react';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import Section from '@jerecocc/tracker-ui/components/Section/Section';
import InfoItem from '@jerecocc/tracker-ui/components/InfoItem/InfoItem';
import type { GameRecord, UpdateGameInfoData } from '@/hooks/useGames';
import GameInfoEditModal from '../GameInfoEditModal';
import { GAME_TYPE_LABEL } from '../constants';
import {
  DATE_FMT_SHORT,
  TIME_FMT,
  formatEndTime,
  formatEndTimeLocal,
  formatScheduledDate,
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
  showScheduledWatchDate?: boolean;
}

const GameInfoCard = ({
  game,
  busy,
  updateGameInfo,
  useLocalTimezone = false,
  showScheduledWatchDate = false,
}: Props) => {
  const [editOpen, setEditOpen] = useState(false);
  const playoffRoundLabel =
    game.playoff_round != null
      ? (game.playoff_round_names?.[game.playoff_round] ?? `Round ${game.playoff_round}`)
      : null;
  const scheduledWatchDate =
    showScheduledWatchDate && game.scheduled_for
      ? formatScheduledDateLocal(game.scheduled_for, null)
      : null;
  const leagueGameNumber =
    !showScheduledWatchDate && game.league_game_number?.trim()
      ? game.league_game_number.trim()
      : null;

  return (
    <>
      <Section
        title="Game Info"
        action={
          updateGameInfo ? (
            <Button
              variant="outlined"
              intent="neutral"
              icon="edit"
              size="medium"
              tooltip="Edit game info"
              onClick={() => setEditOpen(true)}
            />
          ) : undefined
        }
      >
        <div className={styles.infoGrid}>
          <InfoItem
            label="Type"
            value={GAME_TYPE_LABEL[game.game_type]}
            fullWidth
          />
          {playoffRoundLabel && (
            <InfoItem
              label="Round"
              value={playoffRoundLabel}
            />
          )}
          {game.game_number_in_series != null && (
            <InfoItem
              label="Game in Series"
              value={String(game.game_number_in_series)}
            />
          )}
          <InfoItem
            label="Scheduled Date"
            value={
              useLocalTimezone
                ? formatScheduledDateLocal(game.scheduled_at, game.scheduled_time)
                : formatScheduledDate(game.scheduled_at, DATE_FMT_SHORT)
            }
          />
          <InfoItem
            label="Scheduled Time"
            value={
              useLocalTimezone
                ? formatScheduledTimeLocal(game.scheduled_time, game.scheduled_at)
                : game.scheduled_time
                  ? formatScheduledTime(game.scheduled_time, game.scheduled_at)
                  : null
            }
          />
          {game.status !== 'scheduled' && (
            <>
              <InfoItem
                label="Start Time"
                value={
                  useLocalTimezone
                    ? formatTimestampTimeLocal(game.time_start)
                    : game.time_start
                      ? TIME_FMT.format(new Date(game.time_start))
                      : null
                }
              />
              <InfoItem
                label="End Time"
                value={
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
            value={game.venue ?? null}
            fullWidth
          />
          {(scheduledWatchDate || leagueGameNumber) && (
            <>
              <div
                className={styles.infoDivider}
                aria-hidden="true"
              />
              {scheduledWatchDate && (
                <InfoItem
                  label="Scheduled Watch Date"
                  value={scheduledWatchDate}
                  fullWidth
                />
              )}
              {leagueGameNumber && (
                <InfoItem
                  label="League Game Number"
                  value={leagueGameNumber}
                  fullWidth
                />
              )}
            </>
          )}
          {game.notes && (
            <InfoItem
              label="Notes"
              value={game.notes}
              fullWidth
            />
          )}
        </div>
      </Section>

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
