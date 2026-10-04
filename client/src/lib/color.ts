export * from '@jerecocc/tracker-ui/lib/color';

/** WCAG relative luminance of a hex color (#rgb or #rrggbb). */
export function relativeLuminance(hex: string): number {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * toLinear(parseInt(h.slice(0, 2), 16)) +
    0.7152 * toLinear(parseInt(h.slice(2, 4), 16)) +
    0.0722 * toLinear(parseInt(h.slice(4, 6), 16))
  );
}

/** WCAG contrast ratio between two hex colors (1–21). */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const parseHex = (hex: string): [number, number, number] | null => {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};

/**
 * Mixes `color` into `base`, `share` (0–1) being how much of `color` to use — the same
 * result as CSS `color-mix(in srgb, color share, base)`. Returns null for non-hex input.
 */
export function mixHex(color: string, base: string, share: number): string | null {
  const from = parseHex(color);
  const to = parseHex(base);
  if (!from || !to) return null;
  return `#${from
    .map((channel, i) =>
      Math.round(channel * share + to[i] * (1 - share))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/**
 * Returns `color`, or the least-adjusted shade of it that reaches `minRatio` contrast on
 * `background`: lightened toward white on dark backgrounds, darkened toward black on light
 * ones, so the hue carries through. Returns `color` unchanged for non-hex input.
 */
export function ensureContrast(color: string, background: string, minRatio: number): string {
  if (!mixHex(color, background, 1) || contrastRatio(color, background) >= minRatio) {
    return color;
  }
  const target =
    contrastRatio('#ffffff', background) >= contrastRatio('#000000', background)
      ? '#ffffff'
      : '#000000';
  for (let step = 1; step <= 20; step += 1) {
    const adjusted = mixHex(target, color, step / 20)!;
    if (contrastRatio(adjusted, background) >= minRatio) return adjusted;
  }
  return target;
}
