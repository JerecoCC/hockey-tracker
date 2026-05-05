import { useState } from 'react';
import Button from '@/components/Button/Button';
import Card from '@/components/Card/Card';
import InfoItem from '@/components/InfoItem/InfoItem';
import type { GameRecord, UpdateGameInfoData } from '@/hooks/useGames';
import GameInfoEditModal from '../GameInfoEditModal';
import { GAME_TYPE_LABEL } from '../constants';
import { DATE_FMT_SHORT, TIME_FMT, formatScheduledTime } from '../formatUtils';
import styles from './GameInfoCard.module.scss';

interface Props {
  game: GameRecord;
  busy: string | null;
  updateGameInfo: (data: UpdateGameInfoData) => Promise<boolean>;
}

const GameInfoCard = ({ game, busy, updateGameInfo }: Props) => {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <Card
        title="Game Info"
        action={
          <Button
            variant="outlined"
            intent="neutral"
            icon="edit"
            size="sm"
            tooltip="Edit game info"
            onClick={() => setEditOpen(true)}
          />
        }
      >
        <div className={styles.infoGrid}>
          <InfoItem
            label="Type"
            data={GAME_TYPE_LABEL[game.game_type]}
            full
          />
          <InfoItem
            label="Scheduled Date"
            data={game.scheduled_at ? DATE_FMT_SHORT.format(new Date(game.scheduled_at)) : null}
          />
          <InfoItem
            label="Scheduled Time"
            data={
              game.scheduled_time
                ? formatScheduledTime(game.scheduled_time, game.scheduled_at)
                : null
            }
          />
          <InfoItem
            label="Start Time"
            data={game.time_start ? TIME_FMT.format(new Date(game.time_start)) : null}
          />
          <InfoItem
            label="End Time"
            data={game.time_end ? TIME_FMT.format(new Date(game.time_end)) : null}
          />
          <InfoItem
            label="Venue"
            data={game.venue ?? null}
            full
          />
          {game.game_number != null && (
            <InfoItem
              label="Game #"
              data={String(game.game_number)}
            />
          )}
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
