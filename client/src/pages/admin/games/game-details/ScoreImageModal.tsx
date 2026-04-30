import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import Button from '@/components/Button/Button';
import Icon from '@/components/Icon/Icon';
import Modal from '@/components/Modal/Modal';
import type { GameRecord } from '@/hooks/useGames';
import styles from './ScoreImageModal.module.scss';

// ── Constants ─────────────────────────────────────────────────────────────────

// Instagram Stories: 1080 × 1920  (9:16)
const W = 1080;
const H = 1920;

// Section Y boundaries
const HERO_H = 980;
const SEP_Y = HERO_H;
const SEP_H = 92;
const SCORE_Y = SEP_Y + SEP_H;
const SCORE_H = 520;
const BOT_Y = SCORE_Y + SCORE_H; // 1592
const BOT_H = H - BOT_Y; // 328

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

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

/** Convert a hex color string to rgba(...) with the given alpha. */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
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

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  game: GameRecord;
  liveAwayScore: number;
  liveHomeScore: number;
  overtimeSuffix: string;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const ScoreImageModal = ({
  open,
  game,
  liveAwayScore,
  liveHomeScore,
  overtimeSuffix,
  onClose,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroPreviewUrl, setHeroPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Crop state — position 0-100 (%), zoom 1-3×
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const [cropZoom, setCropZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

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

  // Clear hero image + crop whenever the modal closes
  useEffect(() => {
    if (!open) {
      setHeroFile(null);
      setHeroPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      resetCrop();
    }
  }, [open]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setHeroPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setHeroFile(file);
    resetCrop();
  };

  const handleClear = () => {
    setHeroPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setHeroFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    resetCrop();
  };

  // ── Drag-to-pan handlers ──────────────────────────────────────────────────────

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
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

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
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

  const handleDownload = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setGenerating(true);
    try {
      const [awayImg, homeImg, heroImg] = await Promise.all([
        game.away_team_logo ? loadImage(game.away_team_logo) : Promise.resolve(null),
        game.home_team_logo ? loadImage(game.home_team_logo) : Promise.resolve(null),
        heroFile ? loadLocalImage(heroFile) : Promise.resolve(null),
      ]);

      const awayWon = liveAwayScore > liveHomeScore;
      const homeWon = liveHomeScore > liveAwayScore;
      const awayPrimary = game.away_team_primary_color;
      const homePrimary = game.home_team_primary_color;

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
        // Subtle team-color tints on each side
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
      } else {
        // Subtle horizontal scan-lines (ice texture)
        ctx.strokeStyle = 'rgba(255,255,255,0.025)';
        ctx.lineWidth = 1;
        for (let y = 10; y < HERO_H; y += 22) {
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
          400,
          awayPrimary,
          game.away_team_text_color,
          game.away_team_code,
          0.13,
        );
        drawLogo(
          ctx,
          homeImg,
          W * 0.75,
          HERO_H * 0.5,
          400,
          homePrimary,
          game.home_team_text_color,
          game.home_team_code,
          0.13,
        );
      }

      // League + season pill at top
      const leagueLine = [game.league_name, game.season_name].filter(Boolean).join('  ·  ');
      if (leagueLine) {
        ctx.font = '700 28px "Inter",system-ui,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const lm = ctx.measureText(leagueLine.toUpperCase());
        const lpW = lm.width + 48;
        const lpH = 52;
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.roundRect(W / 2 - lpW / 2, 44, lpW, lpH, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(W / 2 - lpW / 2, 44, lpW, lpH, 10);
        ctx.stroke();
        ctx.fillStyle = 'rgba(226,232,240,0.92)';
        ctx.fillText(leagueLine.toUpperCase(), W / 2, 44 + lpH / 2);
      }

      // "VS" ghost text centred in hero
      ctx.font = '900 110px "Inter",system-ui,sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('VS', W / 2, HERO_H * 0.5);

      // Team names at bottom corners of hero
      ctx.font = 'bold 34px "Inter",system-ui,sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(248,250,252,0.95)';
      ctx.textAlign = 'left';
      ctx.fillText(game.away_team_name, 52, HERO_H - 44);
      ctx.textAlign = 'right';
      ctx.fillText(game.home_team_name, W - 52, HERO_H - 44);

      // Bottom split color bar
      ctx.fillStyle = awayPrimary;
      ctx.fillRect(0, HERO_H - 8, W / 2, 8);
      ctx.fillStyle = homePrimary;
      ctx.fillRect(W / 2, HERO_H - 8, W / 2, 8);

      // ════════════════════════════════════════════════════════════════════════
      // SECTION 2 — DIVIDER  (SEP_Y → SEP_Y + SEP_H)
      // ════════════════════════════════════════════════════════════════════════
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, SEP_Y, W, SEP_H);

      const finalLabel = `FINAL SCORE${overtimeSuffix ? ` (${overtimeSuffix.replace('/', '')})` : ''}`;
      ctx.font = '700 30px "Inter",system-ui,sans-serif';
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
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(W / 2, scoreMidY - 14, 66, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.arc(W / 2, scoreMidY - 14, 10, 0, Math.PI * 2);
      ctx.fill();

      // Team logos
      const logoSize = 165;
      const awayLogoX = W * 0.15;
      const homeLogoX = W * 0.85;
      drawLogo(
        ctx,
        awayImg,
        awayLogoX,
        scoreMidY - 18,
        logoSize,
        awayPrimary,
        game.away_team_text_color,
        game.away_team_code,
      );
      drawLogo(
        ctx,
        homeImg,
        homeLogoX,
        scoreMidY - 18,
        logoSize,
        homePrimary,
        game.home_team_text_color,
        game.home_team_code,
      );

      // Team codes beneath logos
      ctx.font = '600 22px "Inter",system-ui,sans-serif';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(148,163,184,0.9)';
      ctx.fillText(game.away_team_code, awayLogoX, scoreMidY + logoSize / 2 - 6);
      ctx.fillText(game.home_team_code, homeLogoX, scoreMidY + logoSize / 2 - 6);

      // Score numbers
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 200px "Inter",system-ui,sans-serif';
      ctx.fillStyle = awayWon ? '#f8fafc' : '#475569';
      ctx.textAlign = 'right';
      ctx.fillText(String(liveAwayScore), W / 2 - 86, scoreMidY - 18);
      ctx.fillStyle = homeWon ? '#f8fafc' : '#475569';
      ctx.textAlign = 'left';
      ctx.fillText(String(liveHomeScore), W / 2 + 86, scoreMidY - 18);

      // ════════════════════════════════════════════════════════════════════════
      // SECTION 4 — BOTTOM INFO  (BOT_Y → H)
      // ════════════════════════════════════════════════════════════════════════
      ctx.fillStyle = '#0b1120';
      ctx.fillRect(0, BOT_Y, W, BOT_H);

      // Top divider line
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(60, BOT_Y + 1);
      ctx.lineTo(W - 60, BOT_Y + 1);
      ctx.stroke();

      // Date
      if (game.scheduled_at) {
        ctx.font = '500 32px "Inter",system-ui,sans-serif';
        ctx.fillStyle = 'rgba(226,232,240,0.88)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(DATE_FMT.format(new Date(game.scheduled_at)), W / 2, BOT_Y + 52);
      }

      // League · Season at bottom
      if (leagueLine) {
        ctx.font = '500 24px "Inter",system-ui,sans-serif';
        ctx.fillStyle = 'rgba(100,116,139,0.85)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(leagueLine, W / 2, BOT_Y + BOT_H - 52);
      }

      // ── Download ────────────────────────────────────────────────────────────
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${game.away_team_code}-vs-${game.home_team_code}-final.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Generate Score Card"
      onClose={onClose}
      size="xl"
      footer={
        <div className={styles.footer}>
          <Button
            variant="outlined"
            intent="neutral"
            onClick={onClose}
          >
            Close
          </Button>
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
        <div className={styles.uploadArea}>
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
                Optional · used as the background of the hero section
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

      {/* Canvas is rendered off-screen; only used to produce the PNG */}
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className={styles.canvas}
      />
    </Modal>
  );
};

export default ScoreImageModal;
