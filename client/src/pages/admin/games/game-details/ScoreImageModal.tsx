import {
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Controller, type Control, useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toPng } from 'html-to-image';
import { toast } from 'react-toastify';
import Button from '@/components/Button/Button';
import Checkbox from '@/components/Checkbox/Checkbox';
import DatePicker from '@/components/DatePicker/DatePicker';
import Icon from '@/components/Icon/Icon';
import ImagePreviewModal from '@/components/ImagePreviewModal/ImagePreviewModal';
import Modal from '@/components/Modal/Modal';
import SeasonSelect from '@/components/SeasonSelect/SeasonSelect';
import Select, { type SelectOption } from '@/components/Select/Select';
import type { GameRecord } from '@/hooks/useGames';
import useLeagues, { type LeagueRecord } from '@/hooks/useLeagues';
import useTeams, { type TeamRecord } from '@/hooks/useTeams';
import styles from './ScoreImageModal.module.scss';

const API = import.meta.env.VITE_API_URL || '/api';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

// ── Constants ─────────────────────────────────────────────────────────────────

// Instagram Stories / vertical social format.
const W = 1440;
const H = 2560;
const HERO_H = 1307;
const SEP_Y = HERO_H;
const SEP_H = 123;
const SCORE_Y = SEP_Y + SEP_H;
const SCORE_H = 693;
const BOT_Y = SCORE_Y + SCORE_H; // 2123
const BOT_H = H - BOT_Y; // 437

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});
const DATE_KEY_RE = /^([0-9]{4}-[0-9]{2}-[0-9]{2})/;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Load a local File as an HTMLImageElement via a temporary blob URL. */
async function loadLocalImage(file: File): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function readFileAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function waitForImages(node: HTMLElement) {
  const images = Array.from(node.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }

          const timeout = window.setTimeout(() => resolve(), 3000);
          const done = () => {
            window.clearTimeout(timeout);
            resolve();
          };
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        }),
    ),
  );
}

function getFileDateLabel(scheduledAt?: string | null) {
  if (!scheduledAt) return 'unknown-date';
  const rawDate = scheduledAt.match(DATE_KEY_RE)?.[1];
  if (rawDate) return rawDate;

  const parsed = new Date(scheduledAt);
  if (Number.isNaN(parsed.getTime())) return 'unknown-date';
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function getDownloadFilename(drawGame: DrawGameType | null) {
  if (!drawGame) return 'score-graphic.png';
  return `${drawGame.away_team.code} vs ${drawGame.home_team.code} - ${getFileDateLabel(drawGame.scheduled_at)}.png`;
}

/** Convert a hex color string to rgba(...) with the given alpha. */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

function darkenHexColor(hex: string, amount = 0.28): string {
  const h = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return hex;
  const darken = (part: string) =>
    Math.max(0, Math.round(parseInt(part, 16) * (1 - amount)))
      .toString(16)
      .padStart(2, '0');
  return `#${darken(h.slice(0, 2))}${darken(h.slice(2, 4))}${darken(h.slice(4, 6))}`;
}

/** Draw a logo image or a colored circle-placeholder fallback. */
function drawLogo(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number,
  cy: number,
  size: number,
  primary: string,
  textColor: string,
  code: string,
  alpha = 1,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (img) {
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
  } else {
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = textColor;
    ctx.font = `bold ${Math.round(size * 0.28)}px "Inter",system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(code.slice(0, 3), cx, cy);
  }
  ctx.restore();
}

// ── Minimal game shape required by the canvas renderer ────────────────────────

interface DrawTeam {
  id: string;
  name: string;
  place_name?: string | null;
  team_name?: string | null;
  code: string;
  logo: string | null;
  primary_color: string;
  secondary_color: string;
  text_color: string;
}

interface DrawGameType {
  away_team: DrawTeam;
  home_team: DrawTeam;
  league_id?: string | null;
  league_code?: string | null;
  league_name?: string | null;
  league_logo?: string | null;
  league_primary_color?: string | null;
  season_name?: string | null;
  game_type?: string | null;
  series_games_to_win?: number | null;
  series_home_wins?: number | null;
  series_away_wins?: number | null;
  series_home_team_id?: string | null;
  game_number_in_series?: number | null;
  playoff_round?: number | null;
  playoff_round_names?: Record<number, string> | null;
  scheduled_at?: string | null;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  /** When omitted the modal renders as a standalone graphic generator (hero + form overlays only). */
  game?: GameRecord;
  liveAwayScore?: number;
  liveHomeScore?: number;
  overtimeSuffix?: string;
  onClose: () => void;
  /** When true, renders the headline/caption/toggle form below the upload area. */
  showForm?: boolean;
  /** Admin-only affordance for previewing the generated image before download. */
  allowPreview?: boolean;
}

type ScoreCardFormValues = {
  awayScore: number;
  homeScore: number;
  playoffGameNum: number;
  awayWins: number;
  homeWins: number;
};

interface ScoreCardNumberFieldProps {
  control: Control<ScoreCardFormValues>;
  name: keyof ScoreCardFormValues;
  label: string;
  min?: number;
  max?: number;
}

const ScoreCardNumberField = ({ control, name, label, min, max }: ScoreCardNumberFieldProps) => {
  const inputId = `score-card-${name}`;

  return (
    <div className={styles.formField}>
      <label
        htmlFor={inputId}
        className={styles.formLabel}
      >
        {label}
      </label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <input
            {...field}
            id={inputId}
            type="number"
            min={min}
            max={max}
            step={1}
            inputMode="numeric"
            className={styles.formInput}
            value={field.value ?? ''}
            onChange={(e) => field.onChange(e.target.value)}
          />
        )}
      />
    </div>
  );
};

const ScoreCardTeamLogo = ({ team }: { team: DrawTeam | null }) => {
  if (!team) {
    return <div className={styles.scoreCardLogoPlaceholder}>TBD</div>;
  }

  if (team.logo) {
    return (
      <img
        src={team.logo}
        alt=""
        className={styles.scoreCardLogoImg}
        crossOrigin="anonymous"
      />
    );
  }

  return (
    <div
      className={styles.scoreCardLogoPlaceholder}
      style={{ background: team.primary_color, color: team.text_color }}
    >
      {team.code.slice(0, 3)}
    </div>
  );
};

const ScoreCardTeamName = ({ team }: { team: DrawTeam | null }) => {
  const placeName = team?.place_name?.trim() ?? '';
  const teamName = team?.team_name?.trim() || team?.name || team?.code || 'TBD';

  return (
    <span className={styles.scoreCardTeamName}>
      {placeName && <span>{placeName}</span>}
      <strong>{teamName}</strong>
    </span>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

const ScoreImageModal = ({
  open,
  game,
  liveAwayScore,
  liveHomeScore,
  overtimeSuffix,
  onClose,
  showForm = false,
  allowPreview = false,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scoreCardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroPreviewUrl, setHeroPreviewUrl] = useState<string | null>(null);
  const [heroExportUrl, setHeroExportUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Crop state — position 0-100 (%), zoom 1-3×
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const [cropZoom, setCropZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  // Form fields — customize what appears in the generated image
  const [headline, setHeadline] = useState('');
  const [caption, setCaption] = useState('');
  const [showDate, setShowDate] = useState(true);
  const [showLeagueSeason, setShowLeagueSeason] = useState(true);

  // ── Game-data form state (standalone / showForm mode only) ────────────────
  const [formLeagueId, setFormLeagueId] = useState('');
  const [formSeasonId, setFormSeasonId] = useState('');
  const [formAwayTeamId, setFormAwayTeamId] = useState('');
  const [formHomeTeamId, setFormHomeTeamId] = useState('');
  const [formGameDate, setFormGameDate] = useState('');
  const [formIsPlayoff, setFormIsPlayoff] = useState(false);
  const [formPlayoffRound, setFormPlayoffRound] = useState('');

  // Number inputs managed via react-hook-form for consistent score-card field spacing.
  const {
    control: numControl,
    watch: watchNums,
    reset: resetNums,
  } = useForm<ScoreCardFormValues>({
    defaultValues: { awayScore: 0, homeScore: 0, playoffGameNum: 1, awayWins: 0, homeWins: 0 },
  });
  const numVals = watchNums();

  const isStandaloneForm = showForm && !game;

  // Leagues + teams come from existing hooks (data cached by UserDashboard)
  const { leagues: allLeagues } = useLeagues();
  const { teams: allTeams } = useTeams();

  // Seasons filtered by selected league — fetched via the user seasons endpoint
  const { data: formSeasons = [] } = useQuery<
    {
      id: string;
      name: string;
      start_date: string | null;
      created_at: string;
      is_current: boolean;
      best_of_playoff: number | null;
      league_best_of_playoff: number;
    }[]
  >({
    queryKey: ['user-form-seasons', formLeagueId],
    queryFn: async () => {
      const { data } = await axios.get(`${API}/user/seasons`, {
        headers: authHeaders(),
        params: { league_id: formLeagueId },
      });
      return data;
    },
    enabled: isStandaloneForm && !!formLeagueId,
    staleTime: 5 * 60 * 1000,
  });

  // Derived selections
  const formLeague = (allLeagues as LeagueRecord[]).find((l) => l.id === formLeagueId) ?? null;
  const formSeason = formSeasons.find((s) => s.id === formSeasonId) ?? null;

  // Effective wins-needed: season override → league default → hard fallback 4 (best-of-7).
  // Guard all paths against undefined/NaN so the canvas dot loop always receives a valid integer.
  const formGamesToWin = (() => {
    const bestOf =
      formSeason?.best_of_playoff ??
      formSeason?.league_best_of_playoff ??
      formLeague?.best_of_playoff;
    return bestOf ? Math.ceil(bestOf / 2) : 4;
  })();
  const formTeams = formLeagueId
    ? (allTeams as TeamRecord[]).filter((t) => t.league_id === formLeagueId)
    : (allTeams as TeamRecord[]);
  const formAwayTeam = formTeams.find((t) => t.id === formAwayTeamId) ?? null;
  const formHomeTeam = formTeams.find((t) => t.id === formHomeTeamId) ?? null;

  // Synthetic game built from form data; null until both teams are selected
  const synthGame = useMemo((): DrawGameType | null => {
    if (!isStandaloneForm || !formAwayTeam || !formHomeTeam) return null;
    return {
      away_team: {
        id: formAwayTeam.id,
        name: formAwayTeam.name,
        place_name: formAwayTeam.place_name,
        team_name: formAwayTeam.team_name,
        code: formAwayTeam.code,
        logo: formAwayTeam.logo,
        primary_color: formAwayTeam.primary_color,
        secondary_color: formAwayTeam.secondary_color,
        text_color: formAwayTeam.text_color,
      },
      home_team: {
        id: formHomeTeam.id,
        name: formHomeTeam.name,
        place_name: formHomeTeam.place_name,
        team_name: formHomeTeam.team_name,
        code: formHomeTeam.code,
        logo: formHomeTeam.logo,
        primary_color: formHomeTeam.primary_color,
        secondary_color: formHomeTeam.secondary_color,
        text_color: formHomeTeam.text_color,
      },
      league_id: formLeague?.id ?? null,
      league_code: formLeague?.code ?? null,
      league_name: formLeague?.name ?? null,
      league_logo: formLeague?.logo ?? null,
      league_primary_color: formLeague?.primary_color ?? null,
      season_name: formSeason?.name ?? null,
      game_type: formIsPlayoff ? 'playoff' : 'regular',
      series_games_to_win: formIsPlayoff ? formGamesToWin : null,
      series_home_wins: formIsPlayoff ? Number(numVals.homeWins) : null,
      series_away_wins: formIsPlayoff ? Number(numVals.awayWins) : null,
      series_home_team_id: formIsPlayoff ? formHomeTeam.id : null,
      game_number_in_series: formIsPlayoff ? Number(numVals.playoffGameNum) : null,
      playoff_round: formIsPlayoff && formPlayoffRound ? 1 : null,
      playoff_round_names: formIsPlayoff && formPlayoffRound ? { 1: formPlayoffRound } : null,
      scheduled_at: formGameDate ? `${formGameDate}T00:00:00` : null,
    };
  }, [
    isStandaloneForm,
    formAwayTeam,
    formHomeTeam,
    formLeague,
    formSeason,
    formIsPlayoff,
    formGamesToWin,
    numVals.homeWins,
    numVals.awayWins,
    numVals.playoffGameNum,
    formPlayoffRound,
    formGameDate,
  ]);

  // Stable drag snapshot (avoids stale-closure issues with pointer events)
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startCropX: number;
    startCropY: number;
    containerW: number;
    containerH: number;
  } | null>(null);

  const resetCrop = () => {
    setCropX(50);
    setCropY(50);
    setCropZoom(1);
  };

  // Clear hero image, crop, and form fields whenever the modal closes
  useEffect(() => {
    if (!open) {
      setHeroFile(null);
      setHeroPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setHeroExportUrl(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      resetCrop();
      setHeadline('');
      setCaption('');
      setShowDate(true);
      setShowLeagueSeason(true);
      // Game-data form fields
      setFormLeagueId('');
      setFormSeasonId('');
      setFormAwayTeamId('');
      setFormHomeTeamId('');
      setFormGameDate('');
      setFormIsPlayoff(false);
      setFormPlayoffRound('');
      resetNums();
    }
  }, [open]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    void applyImageFile(file);
  };

  // ── Clipboard paste support ───────────────────────────────────────────────────

  const applyImageFile = async (file: File) => {
    setHeroPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setHeroExportUrl(null);
    setPreviewUrl(null);
    setHeroFile(file);
    resetCrop();
    setHeroExportUrl(await readFileAsDataUrl(file));
  };

  useEffect(() => {
    if (!open) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            void applyImageFile(file);
            e.preventDefault();
          }
          break;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [open]);

  const handleClear = () => {
    setHeroPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setHeroFile(null);
    setHeroExportUrl(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    resetCrop();
  };

  // ── Drag-to-pan handlers ──────────────────────────────────────────────────────

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startCropX: cropX,
      startCropY: cropY,
      containerW: e.currentTarget.offsetWidth,
      containerH: e.currentTarget.offsetHeight,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    // Full-width drag → 100% crop range, scaled by zoom for finer control at high zoom
    const sensitivity = 100 / cropZoom;
    const dx = ((e.clientX - d.startX) / d.containerW) * sensitivity;
    const dy = ((e.clientY - d.startY) / d.containerH) * sensitivity;
    setCropX(Math.min(100, Math.max(0, d.startCropX - dx)));
    setCropY(Math.min(100, Math.max(0, d.startCropY - dy)));
  };

  const handlePointerUp = () => {
    dragRef.current = null;
    setIsDragging(false);
  };

  const drawGame = (game ?? synthGame) as DrawGameType | null;
  const drawAwayScore = liveAwayScore ?? Number(numVals.awayScore);
  const drawHomeScore = liveHomeScore ?? Number(numVals.homeScore);
  const drawOvertimeSuffix = overtimeSuffix ?? '';
  const awayWon = drawAwayScore > drawHomeScore;
  const homeWon = drawHomeScore > drawAwayScore;
  const awayPrimary = drawGame?.away_team.primary_color ?? '#ba0c2f';
  const homePrimary = drawGame?.home_team.primary_color ?? '#003087';
  const winnerCode = awayWon
    ? (drawGame?.away_team.code ?? 'AWY')
    : homeWon
      ? (drawGame?.home_team.code ?? 'HOM')
      : 'TIE';
  const hasOvertimeBadge = !!drawOvertimeSuffix;
  const scoreBadgeLabel = hasOvertimeBadge ? drawOvertimeSuffix.replace('/', '') : '';
  const scoreBadgeTitle = drawOvertimeSuffix
    ? `Final in ${scoreBadgeLabel}`
    : awayWon || homeWon
      ? `${winnerCode} wins`
      : 'Final tied';
  const leagueLine = drawGame
    ? [drawGame.league_name, drawGame.season_name].filter(Boolean).join(' · ')
    : '';
  const topLeagueCode = drawGame?.league_code ?? drawGame?.league_name ?? 'HOCKEY';
  const gameYear = drawGame?.scheduled_at
    ? String(new Date(drawGame.scheduled_at).getFullYear())
    : '';
  const topSeasonName =
    drawGame?.game_type === 'playoff'
      ? ['Playoffs', gameYear].filter(Boolean).join(' ')
      : (drawGame?.season_name ?? '');
  const topTitle =
    drawGame?.game_type === 'playoff'
      ? drawGame.playoff_round != null
        ? (drawGame.playoff_round_names?.[drawGame.playoff_round] ??
          `ROUND ${drawGame.playoff_round}`)
        : 'PLAYOFF'
      : 'FINAL';
  const finalLabel = 'FINAL SCORE';
  const scoreCardPhaseLabel =
    drawGame?.game_type === 'playoff'
      ? topTitle
      : drawGame?.game_type === 'preseason'
        ? 'PRE-SEASON'
        : 'REGULAR SEASON';
  const footerLeague =
    (allLeagues as LeagueRecord[]).find((league) => league.id === drawGame?.league_id) ??
    (allLeagues as LeagueRecord[]).find((league) => league.code === drawGame?.league_code) ??
    formLeague;
  const footerLeagueLogo = drawGame?.league_logo ?? footerLeague?.logo ?? null;
  const footerLeagueCode = drawGame?.league_code ?? footerLeague?.code ?? topLeagueCode;
  const leaguePrimary = drawGame?.league_primary_color ?? footerLeague?.primary_color ?? '#111214';
  const leagueBand = darkenHexColor(leaguePrimary);
  const isPlayoffScoreCard =
    drawGame?.game_type === 'playoff' &&
    drawGame.series_games_to_win != null &&
    drawGame.series_home_wins != null &&
    drawGame.series_away_wins != null;
  const seriesTotal = isPlayoffScoreCard ? drawGame.series_games_to_win! : 0;
  const awayIsSeriesHome =
    isPlayoffScoreCard && drawGame.away_team.id === drawGame.series_home_team_id;
  const awaySeriesWins = isPlayoffScoreCard
    ? awayIsSeriesHome
      ? drawGame.series_home_wins!
      : drawGame.series_away_wins!
    : 0;
  const homeSeriesWins = isPlayoffScoreCard
    ? awayIsSeriesHome
      ? drawGame.series_away_wins!
      : drawGame.series_home_wins!
    : 0;
  const seriesStatusLine = scoreCardPhaseLabel;
  const canPreview = allowPreview && !!game;

  const renderScoreCardImage = async () => {
    const scoreCardNode = scoreCardRef.current;
    if (!scoreCardNode) return null;

    await waitForImages(scoreCardNode);
    return toPng(scoreCardNode, {
      cacheBust: true,
      pixelRatio: 1,
      backgroundColor: '#f8fafc',
      width: W,
      height: H,
      style: {
        width: `${W}px`,
        height: `${H}px`,
      },
    });
  };

  const handleDownload = async () => {
    if (scoreCardRef.current) {
      setGenerating(true);
      try {
        const url = await renderScoreCardImage();
        if (url) {
          const a = document.createElement('a');
          a.href = url;
          a.download = getDownloadFilename(drawGame);
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } catch (err) {
        console.error('Failed to generate score card image', err);
        toast.error('Failed to generate score card image');
      } finally {
        setGenerating(false);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setGenerating(true);
    try {
      // Resolve the effective game (prop takes priority; fall back to synth game from form)
      const drawGame = (game ?? synthGame) as DrawGameType | null;
      const drawAwayScore = liveAwayScore ?? Number(numVals.awayScore);
      const drawHomeScore = liveHomeScore ?? Number(numVals.homeScore);
      const drawOvertimeSuffix = overtimeSuffix ?? '';

      const [awayImg, homeImg, heroImg] = await Promise.all([
        drawGame?.away_team.logo ? loadImage(drawGame.away_team.logo) : Promise.resolve(null),
        drawGame?.home_team.logo ? loadImage(drawGame.home_team.logo) : Promise.resolve(null),
        heroFile ? loadLocalImage(heroFile) : Promise.resolve(null),
      ]);

      const away = drawAwayScore;
      const home = drawHomeScore;
      const awayWon = away > home;
      const homeWon = home > away;
      const awayPrimary = drawGame?.away_team.primary_color ?? '#334155';
      const homePrimary = drawGame?.home_team.primary_color ?? '#334155';

      // ════════════════════════════════════════════════════════════════════════
      // SECTION 1 — HERO  (y 0 → HERO_H)
      // ════════════════════════════════════════════════════════════════════════
      ctx.fillStyle = '#0b1120';
      ctx.fillRect(0, 0, W, HERO_H);

      if (heroImg) {
        // Cover-fit + crop: apply zoom on top of cover scale, then pan via cropX/Y
        const coverScale = Math.max(W / heroImg.naturalWidth, HERO_H / heroImg.naturalHeight);
        const scale = coverScale * cropZoom;
        const dw = heroImg.naturalWidth * scale;
        const dh = heroImg.naturalHeight * scale;
        // cropX/Y are 0–100 %; map to pixel offset within the "overflow" space
        const dx = (W - dw) * (cropX / 100);
        const dy = (HERO_H - dh) * (cropY / 100);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, HERO_H);
        ctx.clip();
        ctx.drawImage(heroImg, dx, dy, dw, dh);
        ctx.restore();
        // Dark overlay so text stays legible
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, W, HERO_H);
        // Subtle team-color tints on each side (only when game is available)
        if (drawGame) {
          const lh1 = ctx.createLinearGradient(0, 0, W * 0.6, 0);
          lh1.addColorStop(0, hexToRgba(awayPrimary, 0.3));
          lh1.addColorStop(1, hexToRgba(awayPrimary, 0));
          ctx.fillStyle = lh1;
          ctx.fillRect(0, 0, W * 0.6, HERO_H);
          const lh2 = ctx.createLinearGradient(W, 0, W * 0.4, 0);
          lh2.addColorStop(0, hexToRgba(homePrimary, 0.3));
          lh2.addColorStop(1, hexToRgba(homePrimary, 0));
          ctx.fillStyle = lh2;
          ctx.fillRect(W * 0.4, 0, W * 0.6, HERO_H);
        }
      } else if (drawGame) {
        // Subtle horizontal scan-lines (ice texture)
        ctx.strokeStyle = 'rgba(255,255,255,0.025)';
        ctx.lineWidth = 1;
        for (let y = 13; y < HERO_H; y += 29) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(W, y);
          ctx.stroke();
        }
        // Away color wash — left-to-right fade
        const leftGrad = ctx.createLinearGradient(0, 0, W * 0.6, 0);
        leftGrad.addColorStop(0, hexToRgba(awayPrimary, 0.55));
        leftGrad.addColorStop(0.5, hexToRgba(awayPrimary, 0.18));
        leftGrad.addColorStop(1, hexToRgba(awayPrimary, 0));
        ctx.fillStyle = leftGrad;
        ctx.fillRect(0, 0, W * 0.6, HERO_H);
        // Home color wash — right-to-left fade
        const rightGrad = ctx.createLinearGradient(W, 0, W * 0.4, 0);
        rightGrad.addColorStop(0, hexToRgba(homePrimary, 0.55));
        rightGrad.addColorStop(0.5, hexToRgba(homePrimary, 0.18));
        rightGrad.addColorStop(1, hexToRgba(homePrimary, 0));
        ctx.fillStyle = rightGrad;
        ctx.fillRect(W * 0.4, 0, W * 0.6, HERO_H);
        // Large watermark logos (low-opacity background)
        drawLogo(
          ctx,
          awayImg,
          W * 0.25,
          HERO_H * 0.5,
          533,
          awayPrimary,
          drawGame.away_team.text_color,
          drawGame.away_team.code,
          0.13,
        );
        drawLogo(
          ctx,
          homeImg,
          W * 0.75,
          HERO_H * 0.5,
          533,
          homePrimary,
          drawGame.home_team.text_color,
          drawGame.home_team.code,
          0.13,
        );
      }

      // League + season pill at top
      const leagueLine = drawGame
        ? [drawGame.league_name, drawGame.season_name].filter(Boolean).join('  ·  ')
        : '';
      if (showLeagueSeason && leagueLine) {
        ctx.font = '700 37px "Inter",system-ui,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const lm = ctx.measureText(leagueLine.toUpperCase());
        const lpW = lm.width + 64;
        const lpH = 69;
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.roundRect(W / 2 - lpW / 2, 59, lpW, lpH, 13);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(W / 2 - lpW / 2, 59, lpW, lpH, 13);
        ctx.stroke();
        ctx.fillStyle = 'rgba(226,232,240,0.92)';
        ctx.fillText(leagueLine.toUpperCase(), W / 2, 59 + lpH / 2);
      }

      // Headline / caption (user-supplied) OR "VS" ghost fallback
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (headline) {
        const headlineY = caption ? HERO_H * 0.44 : HERO_H * 0.5;
        ctx.shadowColor = 'rgba(0,0,0,0.65)';
        ctx.shadowBlur = 32;
        ctx.font = 'bold 108px "Inter",system-ui,sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.97)';
        ctx.fillText(headline.toUpperCase(), W / 2, headlineY);
        if (caption) {
          ctx.font = '500 58px "Inter",system-ui,sans-serif';
          ctx.fillStyle = 'rgba(226,232,240,0.88)';
          ctx.shadowBlur = 20;
          ctx.fillText(caption, W / 2, HERO_H * 0.58);
        }
        ctx.shadowBlur = 0;
      } else {
        ctx.font = '900 147px "Inter",system-ui,sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillText('VS', W / 2, HERO_H * 0.5);
      }

      // Team names at bottom corners of hero (only when game is available)
      if (drawGame) {
        ctx.font = 'bold 45px "Inter",system-ui,sans-serif';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(248,250,252,0.95)';
        ctx.textAlign = 'left';
        ctx.fillText(drawGame.away_team.name, 69, HERO_H - 59);
        ctx.textAlign = 'right';
        ctx.fillText(drawGame.home_team.name, W - 69, HERO_H - 59);

        // Bottom split color bar
        ctx.fillStyle = awayPrimary;
        ctx.fillRect(0, HERO_H - 11, W / 2, 11);
        ctx.fillStyle = homePrimary;
        ctx.fillRect(W / 2, HERO_H - 11, W / 2, 11);
      }

      // ════════════════════════════════════════════════════════════════════════
      // SECTIONS 2-4 — only rendered when game data is available
      // ════════════════════════════════════════════════════════════════════════
      if (drawGame) {
        // ════════════════════════════════════════════════════════════════════════
        // SECTION 2 — DIVIDER  (SEP_Y → SEP_Y + SEP_H)
        // ════════════════════════════════════════════════════════════════════════
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, SEP_Y, W, SEP_H);

        const finalLabel = `FINAL SCORE${drawOvertimeSuffix ? ` (${drawOvertimeSuffix.replace('/', '')})` : ''}`;
        ctx.font = '700 40px "Inter",system-ui,sans-serif';
        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(finalLabel, W / 2, SEP_Y + SEP_H / 2);

        // ════════════════════════════════════════════════════════════════════════
        // SECTION 3 — SCORE  (SCORE_Y → SCORE_Y + SCORE_H)
        // ════════════════════════════════════════════════════════════════════════
        const scoreMidY = SCORE_Y + SCORE_H / 2;

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, SCORE_Y, W, SCORE_H);

        // Team color panels behind scores
        const lgs1 = ctx.createLinearGradient(0, 0, W * 0.44, 0);
        lgs1.addColorStop(0, hexToRgba(awayPrimary, 0.55));
        lgs1.addColorStop(1, hexToRgba(awayPrimary, 0));
        ctx.fillStyle = lgs1;
        ctx.fillRect(0, SCORE_Y, W * 0.44, SCORE_H);

        const lgs2 = ctx.createLinearGradient(W, 0, W * 0.56, 0);
        lgs2.addColorStop(0, hexToRgba(homePrimary, 0.55));
        lgs2.addColorStop(1, hexToRgba(homePrimary, 0));
        ctx.fillStyle = lgs2;
        ctx.fillRect(W * 0.56, SCORE_Y, W * 0.44, SCORE_H);

        // Center ice-circle motif
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(W / 2, scoreMidY - 19, 88, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.arc(W / 2, scoreMidY - 19, 13, 0, Math.PI * 2);
        ctx.fill();

        // Team logos
        const logoSize = 220;
        const awayLogoX = W * 0.15;
        const homeLogoX = W * 0.85;
        drawLogo(
          ctx,
          awayImg,
          awayLogoX,
          scoreMidY - 24,
          logoSize,
          awayPrimary,
          drawGame.away_team.text_color,
          drawGame.away_team.code,
        );
        drawLogo(
          ctx,
          homeImg,
          homeLogoX,
          scoreMidY - 24,
          logoSize,
          homePrimary,
          drawGame.home_team.text_color,
          drawGame.home_team.code,
        );

        // Team codes beneath logos
        ctx.font = '600 29px "Inter",system-ui,sans-serif';
        ctx.textBaseline = 'top';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(148,163,184,0.9)';
        ctx.fillText(drawGame.away_team.code, awayLogoX, scoreMidY + logoSize / 2 - 8);
        ctx.fillText(drawGame.home_team.code, homeLogoX, scoreMidY + logoSize / 2 - 8);

        // Series win dots (playoff only)
        if (
          drawGame.game_type === 'playoff' &&
          drawGame.series_games_to_win != null &&
          drawGame.series_home_wins != null &&
          drawGame.series_away_wins != null
        ) {
          const total = drawGame.series_games_to_win;
          const dotR = 16;
          const dotGap = 13;
          const dotsW = total * dotR * 2 + (total - 1) * dotGap;
          // y position: below the team code text (code baseline ≈ scoreMidY + logoSize/2 + 35)
          const dotCY = scoreMidY + logoSize / 2 + 64;

          // Which team maps to which position on canvas
          const awayIsSeriesHome = drawGame.away_team.id === drawGame.series_home_team_id;
          const awayWins = awayIsSeriesHome ? drawGame.series_home_wins : drawGame.series_away_wins;
          const homeWins = awayIsSeriesHome ? drawGame.series_away_wins : drawGame.series_home_wins;

          const drawDots = (centerX: number, wins: number, isWinner: boolean) => {
            for (let i = 0; i < total; i++) {
              const cx = centerX - dotsW / 2 + i * (dotR * 2 + dotGap) + dotR;
              const filled = i < wins;
              ctx.beginPath();
              ctx.arc(cx, dotCY, dotR, 0, Math.PI * 2);
              if (filled) {
                ctx.fillStyle = '#22c55e'; // green
                ctx.fill();
              } else {
                ctx.strokeStyle = isWinner ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.18)';
                ctx.lineWidth = 2;
                ctx.stroke();
              }
            }
          };

          drawDots(awayLogoX, awayWins, awayWon);
          drawDots(homeLogoX, homeWins, homeWon);
        }

        // Score numbers
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 267px "Inter",system-ui,sans-serif';
        ctx.fillStyle = awayWon ? '#f8fafc' : '#475569';
        ctx.textAlign = 'right';
        ctx.fillText(String(drawAwayScore), W / 2 - 115, scoreMidY - 24);
        ctx.fillStyle = homeWon ? '#f8fafc' : '#475569';
        ctx.textAlign = 'left';
        ctx.fillText(String(drawHomeScore), W / 2 + 115, scoreMidY - 24);

        // ════════════════════════════════════════════════════════════════════════
        // SECTION 4 — BOTTOM INFO  (BOT_Y → H)
        // ════════════════════════════════════════════════════════════════════════
        ctx.fillStyle = '#0b1120';
        ctx.fillRect(0, BOT_Y, W, BOT_H);

        // Top divider line
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(80, BOT_Y + 1);
        ctx.lineTo(W - 80, BOT_Y + 1);
        ctx.stroke();

        // Date
        if (showDate && drawGame.scheduled_at) {
          ctx.font = '500 43px "Inter",system-ui,sans-serif';
          ctx.fillStyle = 'rgba(226,232,240,0.88)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(DATE_FMT.format(new Date(drawGame.scheduled_at)), W / 2, BOT_Y + 69);
        }

        // Playoff indicator — only rendered for playoff games
        if (drawGame.game_type === 'playoff') {
          const roundLabel =
            drawGame.playoff_round != null
              ? (drawGame.playoff_round_names?.[drawGame.playoff_round] ??
                `Round ${drawGame.playoff_round}`)
              : null;
          const gameLabel =
            drawGame.game_number_in_series != null
              ? `Game ${drawGame.game_number_in_series}`
              : null;
          const seriesLine = [roundLabel, gameLabel].filter(Boolean).join(' · ');

          // "PLAYOFFS" pill
          const pillText = 'PLAYOFFS';
          const pillPadX = 37;
          const pillH = 53;
          const pillY = BOT_Y + 139;
          ctx.font = 'bold 28px "Inter",system-ui,sans-serif';
          const pillW = ctx.measureText(pillText).width + pillPadX * 2;
          const pillX = W / 2 - pillW / 2;

          ctx.fillStyle = 'rgba(56,189,248,0.12)';
          ctx.beginPath();
          ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(56,189,248,0.45)';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = 'rgb(56,189,248)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(pillText, W / 2, pillY + pillH / 2);

          // Round · Game line below the pill
          if (seriesLine) {
            ctx.font = '500 40px "Inter",system-ui,sans-serif';
            ctx.fillStyle = 'rgba(226,232,240,0.9)';
            ctx.textBaseline = 'top';
            ctx.fillText(seriesLine, W / 2, pillY + pillH + 19);
          }
        }

        // League · Season at bottom
        if (showLeagueSeason && leagueLine) {
          ctx.font = '500 32px "Inter",system-ui,sans-serif';
          ctx.fillStyle = 'rgba(100,116,139,0.85)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(leagueLine, W / 2, BOT_Y + BOT_H - 69);
        }
      } // end if (drawGame)

      // ── Download ────────────────────────────────────────────────────────────
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = getDownloadFilename(drawGame);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setGenerating(false);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const url = await renderScoreCardImage();
      if (url) setPreviewUrl(url);
    } catch (err) {
      console.error('Failed to preview score card image', err);
      toast.error('Failed to preview score card image');
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        title="Generate Score Card"
        onClose={onClose}
        size="xl"
        disableBackdropClose={isStandaloneForm}
        footer={
          <div className={styles.footer}>
            <Button
              variant="outlined"
              intent="neutral"
              onClick={onClose}
            >
              Close
            </Button>
            {canPreview && (
              <Button
                variant="outlined"
                intent="accent"
                icon="visibility"
                onClick={handlePreview}
                disabled={generating || previewing}
              >
                {previewing ? 'Generating Preview…' : 'Preview Image'}
              </Button>
            )}
            <Button
              variant="filled"
              intent="accent"
              icon="download"
              onClick={handleDownload}
              disabled={generating}
            >
              {generating ? 'Generating…' : 'Download Image'}
            </Button>
          </div>
        }
      >
        {/* Hero image upload zone */}
        <div className={styles.uploadAreaWrap}>
          <div className={`${styles.uploadArea}${!showForm ? ` ${styles.uploadAreaLarge}` : ''}`}>
            {heroPreviewUrl ? (
              <div
                ref={previewRef}
                className={`${styles.uploadPreview} ${isDragging ? styles.uploadPreviewDragging : ''}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                {/* Draggable preview image */}
                <img
                  src={heroPreviewUrl}
                  draggable={false}
                  className={styles.uploadPreviewImg}
                  style={{
                    objectPosition: `${cropX}% ${cropY}%`,
                    transform: cropZoom !== 1 ? `scale(${cropZoom})` : undefined,
                    transformOrigin: `${cropX}% ${cropY}%`,
                  }}
                />

                {/* Remove button */}
                <button
                  type="button"
                  className={styles.uploadClear}
                  onClick={handleClear}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label="Remove hero image"
                >
                  ✕
                </button>

                {/* Zoom slider */}
                <div className={styles.uploadZoomBar}>
                  <span className={styles.uploadZoomIcon}>−</span>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    value={cropZoom}
                    className={styles.uploadZoomSlider}
                    onChange={(e) => setCropZoom(Number(e.target.value))}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                  <span className={styles.uploadZoomIcon}>+</span>
                </div>
              </div>
            ) : (
              <label className={styles.uploadLabel}>
                <Icon
                  name="upload"
                  size="2em"
                />
                <span className={styles.uploadLabelPrimary}>Upload Hero Image</span>
                <span className={styles.uploadLabelSub}>
                  Click to browse · or paste an image from clipboard
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className={styles.uploadInput}
                  onChange={handleFileChange}
                />
              </label>
            )}
          </div>
        </div>

        {/* ── Image options form (user dashboard only) ── */}
        {showForm && (
          <div className={styles.formSection}>
            {/* ── Game data (standalone mode) ── */}
            {isStandaloneForm &&
              (() => {
                const leagueOptions: SelectOption[] = allLeagues.map((l) => ({
                  value: l.id,
                  label: l.name,
                  logo: l.logo,
                  code: l.code,
                }));
                const teamOptions: SelectOption[] = formTeams.map((t) => ({
                  value: t.id,
                  label: t.name,
                  logo: t.logo,
                  code: t.code,
                }));
                return (
                  <>
                    {/* Row: League | Season */}
                    <div className={styles.formRow}>
                      <div className={styles.formField}>
                        <label className={styles.formLabel}>League</label>
                        <Select
                          value={formLeagueId || null}
                          options={leagueOptions}
                          placeholder="— Select league —"
                          onChange={(val) => {
                            setFormLeagueId(val);
                            setFormSeasonId('');
                            setFormAwayTeamId('');
                            setFormHomeTeamId('');
                          }}
                          searchable
                        />
                      </div>
                      <div className={styles.formField}>
                        <label className={styles.formLabel}>Season</label>
                        <SeasonSelect
                          value={formSeasonId || null}
                          seasons={formSeasons}
                          placeholder="— Select season —"
                          onChange={setFormSeasonId}
                          disabled={!formLeagueId}
                        />
                      </div>
                    </div>

                    {/* Row: Away Team | Home Team */}
                    <div className={styles.formRow}>
                      <div className={styles.formField}>
                        <label className={styles.formLabel}>Away Team</label>
                        <Select
                          value={formAwayTeamId || null}
                          options={teamOptions}
                          placeholder="— Select team —"
                          onChange={setFormAwayTeamId}
                          disabled={!formLeagueId}
                          searchable
                        />
                      </div>
                      <div className={styles.formField}>
                        <label className={styles.formLabel}>Home Team</label>
                        <Select
                          value={formHomeTeamId || null}
                          options={teamOptions}
                          placeholder="— Select team —"
                          onChange={setFormHomeTeamId}
                          disabled={!formLeagueId}
                          searchable
                        />
                      </div>
                    </div>

                    {/* Row: Date | Away Score | Home Score */}
                    <div className={styles.formRow3}>
                      <div className={styles.formField}>
                        <label className={styles.formLabel}>Game Date</label>
                        <DatePicker
                          value={formGameDate}
                          onChange={setFormGameDate}
                          placeholder="Select date"
                        />
                      </div>
                      <ScoreCardNumberField
                        label="Away Score"
                        control={numControl}
                        name="awayScore"
                        min={0}
                      />
                      <ScoreCardNumberField
                        label="Home Score"
                        control={numControl}
                        name="homeScore"
                        min={0}
                      />
                    </div>

                    {/* Playoff checkbox */}
                    <div
                      className={styles.formCheckboxRow}
                      onClick={() => setFormIsPlayoff((value) => !value)}
                    >
                      <Checkbox
                        checked={formIsPlayoff}
                        onChange={() => setFormIsPlayoff((value) => !value)}
                      />
                      <span className={styles.formCheckboxLabel}>Playoff Game</span>
                    </div>

                    {/* Playoff sub-section */}
                    {formIsPlayoff && (
                      <div className={styles.playoffSection}>
                        <div className={styles.playoffFieldsRow}>
                          <div className={`${styles.formField} ${styles.playoffRoundField}`}>
                            <label className={styles.formLabel}>Round</label>
                            <input
                              type="text"
                              className={styles.formInput}
                              placeholder="e.g. Quarterfinals"
                              value={formPlayoffRound}
                              onChange={(e) => setFormPlayoffRound(e.target.value)}
                            />
                          </div>
                          <ScoreCardNumberField
                            label="Game #"
                            control={numControl}
                            name="playoffGameNum"
                            min={1}
                            max={7}
                          />
                          <ScoreCardNumberField
                            label="Away Wins"
                            control={numControl}
                            name="awayWins"
                            min={0}
                            max={4}
                          />
                          <ScoreCardNumberField
                            label="Home Wins"
                            control={numControl}
                            name="homeWins"
                            min={0}
                            max={4}
                          />
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
          </div>
        )}

        <div className={styles.scoreCardExportShell}>
          <div
            ref={scoreCardRef}
            className={styles.scoreCardExport}
            style={
              {
                width: W,
                height: H,
                '--away-primary': awayPrimary,
                '--home-primary': homePrimary,
                '--league-band': leagueBand,
                '--hero-x': `${cropX}%`,
                '--hero-y': `${cropY}%`,
                '--hero-zoom': cropZoom,
              } as CSSProperties
            }
          >
            <header className={styles.scoreCardTopBar}>
              <div className={styles.scoreCardTopLine} />
              <div className={styles.scoreCardEvent}>
                <span className={styles.scoreCardEventMuted}>{topLeagueCode}</span>
                {topSeasonName && (
                  <span className={styles.scoreCardEventMain}>{topSeasonName}</span>
                )}
              </div>
              <div className={styles.scoreCardTopLine} />
            </header>

            <section className={styles.scoreCardHero}>
              {heroExportUrl ? (
                <img
                  src={heroExportUrl}
                  alt=""
                  className={styles.scoreCardHeroImg}
                />
              ) : (
                <div className={styles.scoreCardHeroFallback}>
                  <ScoreCardTeamLogo team={drawGame?.away_team ?? null} />
                  <span>VS</span>
                  <ScoreCardTeamLogo team={drawGame?.home_team ?? null} />
                </div>
              )}
              <div className={styles.scoreCardHeroShade} />
              {(headline || caption) && (
                <div className={styles.scoreCardHeroText}>
                  {headline && <strong>{headline}</strong>}
                  {caption && <span>{caption}</span>}
                </div>
              )}
            </section>

            <div className={styles.scoreCardScoreRibbon}>
              <span />
              <strong>{finalLabel}</strong>
              <span />
            </div>

            <section className={styles.scoreCardScoreGrid}>
              <div className={`${styles.scoreCardTeamPanel} ${styles.scoreCardTeamPanelAway}`}>
                <ScoreCardTeamLogo team={drawGame?.away_team ?? null} />
                <ScoreCardTeamName team={drawGame?.away_team ?? null} />
              </div>

              <div className={styles.scoreCardScorePanel}>
                <div className={styles.scoreCardScoreBlock}>
                  {awayWon && (
                    <span
                      className={styles.scoreCardWinnerMarker}
                      aria-hidden="true"
                    />
                  )}
                  <strong className={awayWon ? styles.scoreCardWinnerScore : undefined}>
                    {drawAwayScore}
                  </strong>
                </div>

                <span
                  className={`${styles.scoreCardResultBadge}${
                    hasOvertimeBadge ? ` ${styles.scoreCardResultBadgeOvertime}` : ''
                  }`}
                  title={scoreBadgeTitle}
                >
                  {scoreBadgeLabel && (
                    <span className={styles.scoreCardResultLabel}>
                      {hasOvertimeBadge
                        ? scoreBadgeLabel.split('').map((letter, index) => (
                            <span
                              key={`${letter}-${index}`}
                              className={`${styles.scoreCardResultLetter}${
                                letter === 'S' ? ` ${styles.scoreCardResultLetterWide}` : ''
                              }`}
                            >
                              {letter}
                            </span>
                          ))
                        : scoreBadgeLabel}
                    </span>
                  )}
                </span>
                <div className={styles.scoreCardScoreBlock}>
                  {homeWon && (
                    <span
                      className={styles.scoreCardWinnerMarker}
                      aria-hidden="true"
                    />
                  )}
                  <strong className={homeWon ? styles.scoreCardWinnerScore : undefined}>
                    {drawHomeScore}
                  </strong>
                </div>
              </div>

              <div className={`${styles.scoreCardTeamPanel} ${styles.scoreCardTeamPanelHome}`}>
                <ScoreCardTeamLogo team={drawGame?.home_team ?? null} />
                <ScoreCardTeamName team={drawGame?.home_team ?? null} />
              </div>
            </section>

            <section className={styles.scoreCardSeriesBar}>
              <div className={styles.scoreCardSeriesDots}>
                {isPlayoffScoreCard &&
                  Array.from({ length: seriesTotal }, (_, index) => (
                    <span
                      key={`away-dot-${index}`}
                      className={
                        index < awaySeriesWins ? styles.scoreCardSeriesDotFilled : undefined
                      }
                    />
                  ))}
              </div>
              <strong>{seriesStatusLine || leagueLine || 'FINAL'}</strong>
              <div className={styles.scoreCardSeriesDots}>
                {isPlayoffScoreCard &&
                  Array.from({ length: seriesTotal }, (_, index) => (
                    <span
                      key={`home-dot-${index}`}
                      className={
                        index < homeSeriesWins ? styles.scoreCardSeriesDotFilled : undefined
                      }
                    />
                  ))}
              </div>
            </section>

            <footer className={styles.scoreCardFooter}>
              {footerLeagueLogo ? (
                <img
                  src={footerLeagueLogo}
                  alt={`${footerLeagueCode} logo`}
                  className={styles.scoreCardFooterLeagueLogo}
                  crossOrigin="anonymous"
                />
              ) : (
                <strong className={styles.scoreCardFooterLeagueCode}>{footerLeagueCode}</strong>
              )}
              {showDate && drawGame?.scheduled_at && (
                <span>{DATE_FMT.format(new Date(drawGame.scheduled_at))}</span>
              )}
              {showLeagueSeason && leagueLine && <span>{leagueLine}</span>}
            </footer>
          </div>
        </div>

        {/* Canvas is rendered off-screen; only used to produce the PNG */}
        <canvas
          ref={canvasRef}
          width={W}
          height={synthGame || game ? H : HERO_H}
          className={styles.canvas}
        />
      </Modal>

      <ImagePreviewModal
        open={canPreview && !!previewUrl}
        src={previewUrl}
        alt="Generated score card preview"
        onClose={() => setPreviewUrl(null)}
      />
    </>
  );
};

export default ScoreImageModal;
