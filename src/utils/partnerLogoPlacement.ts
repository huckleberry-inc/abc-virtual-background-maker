/**
 * Picks the best corner and size for the partner logo on a background image.
 *
 * Pure functions only (no DOM), so the same code runs in the browser and in
 * Node for offline tuning of the bundled backgrounds.
 */
import type {
  PartnerLogoPlacement,
  PartnerLogoPosition,
  PartnerLogoTone,
} from "@/constants/partnerLogo";

/** Output frame aspect ratio (the editor is fixed to 16:9). */
const FRAME_ASPECT = 16 / 9;

/** Inset from the frame edges, aligned with the text field padding. */
export const PARTNER_LOGO_INSET = { x: 0.04, y: 0.064 };

/** Clear space kept around the logo, as a fraction of the logo height. */
const CLEAR_SPACE = 0.35;

const MIN_SIZE = 0.09;
const MAX_SIZE = 0.12;

/** Calmness thresholds: below LOW the area is treated as empty wall/sky. */
const BUSY_LOW = 0.06;
const BUSY_HIGH = 0.22;

/**
 * Penalty per corner. Bottom-left is where Zoom / Meet / Teams overlay the
 * participant name, and the bottom edge is often hidden by the shoulders or
 * the meeting toolbar, so the top corners are preferred.
 */
const POSITION_PENALTY: Record<PartnerLogoPosition, number> = {
  "top-left": 0,
  "top-right": 0,
  "bottom-right": 0.04,
  "bottom-left": 0.08,
};

export const PARTNER_LOGO_CANDIDATES = Object.keys(
  POSITION_PENALTY,
) as Array<PartnerLogoPosition>;

/** Minimal ImageData shape so Node can pass a plain object. */
export interface PixelGrid {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

export interface LogoRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Logo rectangle in frame fractions (left/width relative to the width,
 * top/height relative to the height).
 */
export const getPartnerLogoRect = (
  { position, size }: PartnerLogoPlacement,
  logoAspect: number,
): LogoRect => {
  const ratio = Math.sqrt(Math.max(logoAspect, 0.01));
  const width = size * ratio;
  const height = (size / ratio) * FRAME_ASPECT;
  const left = position.endsWith("left")
    ? PARTNER_LOGO_INSET.x
    : 1 - PARTNER_LOGO_INSET.x - width;
  const top = position.startsWith("top")
    ? PARTNER_LOGO_INSET.y
    : 1 - PARTNER_LOGO_INSET.y - height;
  return { left, top, width, height };
};

interface Features {
  width: number;
  height: number;
  luma: Float32Array;
  edge: Float32Array;
}

const extractFeatures = ({ width, height, data }: PixelGrid): Features => {
  const size = width * height;
  const luma = new Float32Array(size);
  const cb = new Float32Array(size);
  const cr = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const r = data[i * 4] / 255;
    const g = data[i * 4 + 1] / 255;
    const b = data[i * 4 + 2] / 255;
    luma[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    cb[i] = b - luma[i];
    cr[i] = r - luma[i];
  }
  const edge = new Float32Array(size);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const right = x + 1 < width ? i + 1 : i;
      const down = y + 1 < height ? i + width : i;
      const diff = (arr: Float32Array) =>
        Math.abs(arr[right] - arr[i]) + Math.abs(arr[down] - arr[i]);
      edge[i] = diff(luma) + 0.5 * (diff(cb) + diff(cr));
    }
  }
  return { width, height, luma, edge };
};

/**
 * How busy a region is: texture (mean edge strength, scaled to the grid
 * resolution) plus large tonal changes (luma spread, e.g. a lamp on a wall).
 */
const regionBusyness = (
  { width, height, luma, edge }: Features,
  rect: LogoRect,
): number => {
  const pad = rect.height * CLEAR_SPACE;
  const padX = pad / FRAME_ASPECT;
  const x0 = Math.max(0, Math.floor((rect.left - padX) * width));
  const x1 = Math.min(
    width,
    Math.ceil((rect.left + rect.width + padX) * width),
  );
  const y0 = Math.max(0, Math.floor((rect.top - pad) * height));
  const y1 = Math.min(
    height,
    Math.ceil((rect.top + rect.height + pad) * height),
  );
  let count = 0;
  let edgeSum = 0;
  let lumaSum = 0;
  let lumaSq = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * width + x;
      edgeSum += edge[i];
      lumaSum += luma[i];
      lumaSq += luma[i] * luma[i];
      count++;
    }
  }
  if (count === 0) {
    return Infinity;
  }
  const mean = lumaSum / count;
  const spread = Math.sqrt(Math.max(0, lumaSq / count - mean * mean));
  // Edge strength per pixel shrinks with resolution; normalise to 160px wide.
  const texture = (edgeSum / count) * (width / 160) * 4;
  return texture + spread;
};

export interface PartnerLogoScore {
  position: PartnerLogoPosition;
  busyness: number;
  score: number;
}

/**
 * Suggests the calmest available corner and a size that grows with the free
 * space (calm region → larger, textured region → smaller).
 */
export const suggestPartnerLogoPlacement = (
  grid: PixelGrid,
  logoAspect: number,
  occupied: Array<string> = [],
): { placement: PartnerLogoPlacement; scores: Array<PartnerLogoScore> } => {
  const features = extractFeatures(grid);
  const candidates = PARTNER_LOGO_CANDIDATES.filter(
    (position) => !occupied.includes(position),
  );
  const pool = candidates.length > 0 ? candidates : PARTNER_LOGO_CANDIDATES;
  const probeSize = (MIN_SIZE + MAX_SIZE) / 2;
  const scores = pool
    .map((position) => {
      const busyness = regionBusyness(
        features,
        getPartnerLogoRect({ position, size: probeSize }, logoAspect),
      );
      return {
        position,
        busyness,
        score: busyness + POSITION_PENALTY[position],
      };
    })
    .sort((a, b) => a.score - b.score);

  const best = scores[0];
  const calm = Math.min(
    1,
    Math.max(0, (best.busyness - BUSY_LOW) / (BUSY_HIGH - BUSY_LOW)),
  );
  const size =
    Math.round((MAX_SIZE - (MAX_SIZE - MIN_SIZE) * calm) * 1000) / 1000;
  return { placement: { position: best.position, size }, scores };
};

/** sRGB channel (0-255) to linear light (0-1), as in WCAG relative luminance. */
const toLinear = (channel: number) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG contrast ratio against a black / white badge for a luminance (0-1). */
const contrastWithBlack = (luminance: number) => (luminance + 0.05) / 0.05;
const contrastWithWhite = (luminance: number) => 1.05 / (luminance + 0.05);

/** Contrast the badge needs against the background on average (WCAG AA). */
const MIN_MEAN_CONTRAST = 7;
/** A pixel below this contrast counts as one the badge would blend into. */
const LOW_CONTRAST = 4.5;
/** Above this share of low-contrast pixels the area is too busy for a bare badge. */
const MAX_LOW_CONTRAST_SHARE = 0.12;

export interface PartnerLogoToneOptions {
  /** Whether a white badge (`srcDark`) is available. */
  hasDark?: boolean;
  /** Whether a badge on a white plate (`srcPlate`) is available. */
  hasPlate?: boolean;
}

/**
 * Picks the badge variant for the background inside `rect`.
 *
 * The black or white badge is chosen by which has the higher WCAG contrast
 * against the mean relative luminance of the area (so e.g. a saturated
 * orange gets the black badge). When even the better one is under AA on
 * average, or too many pixels (window frames, foliage, artwork) would blend
 * into it, the badge on its white plate is used instead.
 */
export const choosePartnerLogoTone = (
  { width, height, data }: PixelGrid,
  rect: LogoRect,
  { hasDark = true, hasPlate = false }: PartnerLogoToneOptions = {},
): PartnerLogoTone => {
  const x0 = Math.max(0, Math.floor(rect.left * width));
  const x1 = Math.min(width, Math.ceil((rect.left + rect.width) * width));
  const y0 = Math.max(0, Math.floor(rect.top * height));
  const y1 = Math.min(height, Math.ceil((rect.top + rect.height) * height));
  const luminances: Array<number> = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      luminances.push(
        0.2126 * toLinear(data[i]) +
          0.7152 * toLinear(data[i + 1]) +
          0.0722 * toLinear(data[i + 2]),
      );
    }
  }
  if (luminances.length === 0) {
    return "light";
  }
  const mean = luminances.reduce((sum, l) => sum + l, 0) / luminances.length;
  const tone: PartnerLogoTone =
    hasDark && contrastWithWhite(mean) > contrastWithBlack(mean)
      ? "dark"
      : "light";
  if (!hasPlate) {
    return tone;
  }
  const contrast = tone === "dark" ? contrastWithWhite : contrastWithBlack;
  const lowShare =
    luminances.filter((l) => contrast(l) < LOW_CONTRAST).length /
    luminances.length;
  return contrast(mean) < MIN_MEAN_CONTRAST || lowShare > MAX_LOW_CONTRAST_SHARE
    ? "plate"
    : tone;
};

/** Finds a hand-tuned placement whose key matches the end of the src. */
export const findPartnerLogoPlacement = (
  src: string,
  placements: Record<string, Partial<PartnerLogoPlacement>> = {},
): Partial<PartnerLogoPlacement> | undefined => {
  const path = decodeURIComponent(src.split("?")[0]);
  const key = Object.keys(placements)
    .filter((candidate) => path.endsWith(candidate))
    .sort((a, b) => b.length - a.length)[0];
  return key ? placements[key] : undefined;
};
