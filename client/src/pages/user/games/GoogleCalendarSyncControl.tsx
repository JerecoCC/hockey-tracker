import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import LoadingSpinner from '@jerecocc/tracker-ui/components/LoadingSpinner/LoadingSpinner';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import { API, authHeaders } from '@/lib/apiClient';
import GoogleLogo from '@/shared/GoogleLogo/GoogleLogo';
import {
  getUserTimeZone,
  syncGoogleCalendarWithProgress,
  type GoogleCalendarSyncProgress,
  type GoogleCalendarSyncResult,
} from './googleCalendarSync';
import styles from './GoogleCalendarSyncControl.module.scss';

interface GoogleCalendarStatus {
  configured: boolean;
  connected: boolean;
  calendar_name: string | null;
  time_zone: string | null;
  connected_at: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
}

interface GoogleCalendarSyncTriggerState {
  busy: boolean;
  openSettings: () => void;
}

interface GoogleCalendarSyncControlProps {
  renderTrigger?: (state: GoogleCalendarSyncTriggerState) => ReactNode;
}

const connectErrorMessage = (reason: string | null) => {
  switch (reason) {
    case 'access_denied':
      return 'Google Calendar connection was cancelled';
    case 'calendar_api_disabled':
      return 'Google Calendar API is disabled for this OAuth project. Enable it in Google Cloud, then try again.';
    case 'PERMISSION_DENIED':
      return 'Google Calendar denied access. Verify the Calendar API is enabled in the OAuth project, then try again.';
    case 'insufficient_calendar_scope':
      return 'Google did not grant the required Calendar permission. Reconnect and approve Calendar access.';
    case 'state_mismatch':
      return 'Google Calendar connection expired or its browser cookie was unavailable. Try connecting again.';
    case 'invalid_grant':
      return 'Google authorization expired before it could be completed. Try connecting again.';
    case 'missing_refresh_token':
      return 'Google did not grant offline Calendar access. Remove the app from your Google connections, then reconnect.';
    default:
      return 'Failed to connect Google Calendar';
  }
};

const loadingToastOptions = {
  autoClose: false,
  closeButton: false,
  closeOnClick: false,
  draggable: false,
  hideProgressBar: false,
  pauseOnHover: false,
  progressClassName: styles.progressBar,
};

const startSyncProgressToast = () => {
  let progressValue = 0;
  const toastId = toast.loading('Syncing Google Calendar: preparing scheduled games...', {
    ...loadingToastOptions,
    progress: progressValue,
  });

  return {
    update: (progress: GoogleCalendarSyncProgress) => {
      if (
        typeof progress.completed === 'number' &&
        typeof progress.total === 'number' &&
        progress.total > 0
      ) {
        progressValue = Math.max(
          progressValue,
          Math.min(Math.max(progress.completed / progress.total, 0), 0.98),
        );
      } else {
        progressValue = Math.max(progressValue, Math.min(progressValue + 0.08, 0.9));
      }
      toast.update(toastId, {
        render: `Syncing Google Calendar: ${progress.message}`,
        isLoading: true,
        ...loadingToastOptions,
        progress: progressValue,
      });
    },
    finish: (result: GoogleCalendarSyncResult) => {
      toast.update(toastId, {
        render: `Google Calendar synced: ${result.synced} ${result.synced === 1 ? 'game' : 'games'}, ${result.removed} removed`,
        type: 'success',
        isLoading: false,
        autoClose: 4000,
        closeButton: true,
        closeOnClick: true,
        draggable: true,
        hideProgressBar: true,
        pauseOnHover: true,
        progress: 1,
        progressClassName: styles.progressBar,
      });
    },
    fail: () => {
      toast.update(toastId, {
        render: 'Failed to sync Google Calendar',
        type: 'error',
        isLoading: false,
        autoClose: 12000,
        closeButton: true,
        closeOnClick: true,
        draggable: true,
        hideProgressBar: true,
        pauseOnHover: true,
        progress: 1,
        progressClassName: styles.progressBar,
      });
    },
  };
};

const formatSyncTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

const GoogleCalendarSyncControl = ({ renderTrigger }: GoogleCalendarSyncControlProps) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: status } = useQuery<GoogleCalendarStatus>({
    queryKey: ['google-calendar-status'],
    queryFn: async () => {
      const { data } = await axios.get<GoogleCalendarStatus>(`${API}/user/calendar/google`, {
        headers: authHeaders(),
      });
      return data;
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('google_calendar');
    if (!result) return;

    if (result === 'connected') {
      toast.success('Google Calendar connected and synced');
      void queryClient.invalidateQueries({ queryKey: ['google-calendar-status'] });
    } else {
      toast.error(connectErrorMessage(params.get('reason')));
    }

    params.delete('google_calendar');
    params.delete('reason');
    const search = params.toString();
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`,
    );
  }, [queryClient]);

  const connect = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await axios.post<{ authorization_url: string }>(
        `${API}/user/calendar/google/connect`,
        { time_zone: getUserTimeZone() },
        { headers: authHeaders(), withCredentials: true },
      );
      window.location.assign(data.authorization_url);
    } catch {
      toast.error('Failed to start Google Calendar connection');
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    if (busy) return;
    setBusy(true);
    setOpen(false);
    const progressToast = startSyncProgressToast();
    try {
      const result = await syncGoogleCalendarWithProgress({
        endpoint: `${API}/user/calendar/google/sync`,
        headers: authHeaders(),
        timeZone: getUserTimeZone(),
        onProgress: progressToast.update,
      });
      await queryClient.invalidateQueries({ queryKey: ['google-calendar-status'] });
      progressToast.finish(result);
    } catch {
      progressToast.fail();
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await axios.delete(`${API}/user/calendar/google`, { headers: authHeaders() });
      await queryClient.invalidateQueries({ queryKey: ['google-calendar-status'] });
      setOpen(false);
      toast.success('Google Calendar disconnected');
    } catch {
      toast.error('Failed to disconnect Google Calendar');
    } finally {
      setBusy(false);
    }
  };

  const connected = !!status?.connected;
  const configured = !!status?.configured;
  const lastSyncedAt = formatSyncTime(status?.last_synced_at ?? null);

  return (
    <>
      {renderTrigger ? (
        renderTrigger({
          busy,
          openSettings: () => {
            if (!busy) setOpen(true);
          },
        })
      ) : (
        <Button
          variant="outlined"
          intent="neutral"
          type="button"
          className={styles.iconButton}
          data-connected={connected ? 'true' : 'false'}
          data-syncing={busy ? 'true' : 'false'}
          aria-label={busy ? 'Google Calendar sync in progress' : 'Google Calendar sync settings'}
          tooltip={
            busy
              ? 'Syncing Google Calendar'
              : connected
                ? 'Google Calendar connected'
                : 'Connect Google Calendar'
          }
          onClick={() => {
            if (!busy) setOpen(true);
          }}
        >
          <GoogleLogo className={styles.icon} />
          {busy && (
            <span className={styles.syncOverlay}>
              <LoadingSpinner
                message="Syncing Google Calendar"
                layout="inline"
                size="sm"
                className={styles.syncSpinner}
              />
            </span>
          )}
        </Button>
      )}

      <Modal
        open={open}
        title="Google Calendar Sync"
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        onConfirm={connected ? sync : connect}
        confirmLabel={
          busy
            ? connected
              ? 'Syncing…'
              : 'Connecting…'
            : connected
              ? 'Sync Now'
              : 'Connect Google Calendar'
        }
        confirmDisabled={busy || !configured}
        busy={busy}
        footerStart={
          connected ? (
            <Button
              type="button"
              variant="ghost"
              intent="neutral"
              onClick={disconnect}
              disabled={busy}
            >
              Disconnect &amp; Remove Calendar
            </Button>
          ) : undefined
        }
      >
        <div className={styles.modalBody}>
          {!configured ? (
            <p>
              Google Calendar sync is unavailable until the server OAuth callback and token secret
              are configured.
            </p>
          ) : connected ? (
            <>
              <p>
                Games from the nearest season that is not marked done, filtered to your favorite
                teams, sync as timed events converted to your local timezone in your{' '}
                <strong>{status?.calendar_name || 'Hockey Tracker'}</strong> calendar. A scheduled
                watch date moves the event; clearing that date moves it back to the original game
                date, and skipping the game removes it.
              </p>
              <p className={styles.status}>
                {lastSyncedAt ? `Last synced ${lastSyncedAt}` : 'Connected — not synced yet'}
              </p>
              {status?.last_sync_error && (
                <p className={styles.error}>The last sync failed. Use Sync Now to retry.</p>
              )}
              <p className={styles.disconnectNote}>
                Disconnecting also removes the app-created calendar and its synced events.
              </p>
            </>
          ) : (
            <p>
              Connect Google Calendar to mirror games from the nearest season that is not marked
              done, filtered to your favorite teams. Hockey Tracker creates a separate calendar and
              can only manage events inside that calendar.
            </p>
          )}
        </div>
      </Modal>
    </>
  );
};

export default GoogleCalendarSyncControl;
