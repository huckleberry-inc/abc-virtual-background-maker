export const PartnerLogoPositions = {
  "top-left": "Top Left",
  "top-right": "Top Right",
  "bottom-left": "Bottom Left",
  "bottom-right": "Bottom Right",
} as const;

export type PartnerLogoPosition = keyof typeof PartnerLogoPositions;

export const PartnerLogoSizes = {
  small: 0.09,
  medium: 0.105,
  large: 0.12,
} as const;

export type PartnerLogoSize = keyof typeof PartnerLogoSizes;

/**
 * Where and how large the partner logo is drawn.
 * `size` is the "area-equivalent" edge length as a fraction of the image width,
 * i.e. sqrt(logoWidth * logoHeight) / imageWidth. Using the area instead of the
 * width keeps the visual weight constant regardless of the badge aspect ratio.
 */
export interface PartnerLogoPlacement {
  position: PartnerLogoPosition;
  size: number;
}

export const PartnerLogoTones = {
  light: "Black",
  dark: "White",
  plate: "White plate",
} as const;

/**
 * Which badge variant is drawn:
 * "light" = black badge for light backgrounds (`src`),
 * "dark" = white badge for dark backgrounds (`srcDark`),
 * "plate" = badge on its own white plate for busy / mid-tone backgrounds
 * where neither of the transparent ones has enough contrast (`srcPlate`).
 */
export type PartnerLogoTone = keyof typeof PartnerLogoTones;

export interface PartnerLogoConfig {
  src: string;
  /** Variant for dark backgrounds (white badge). Falls back to `src`. */
  srcDark?: string;
  /**
   * Variant on a white plate, for busy or mid-tone backgrounds where neither
   * `src` nor `srcDark` has enough contrast. Falls back to `src` / `srcDark`.
   */
  srcPlate?: string;
  alt?: string;
  isVisible?: boolean;
  /**
   * Hand-tuned placements per background. The key is matched against the end of
   * the background `src` (e.g. "office/01.jpg").
   */
  placements?: Record<string, Partial<PartnerLogoPlacement>>;
  /**
   * Corners to keep free for text field groups with custom positions.
   * The key is matched against the start of the group `position`
   * (e.g. "hb" covers "hb", "hb-2024-1", ...).
   */
  avoid?: Record<string, Array<PartnerLogoPosition>>;
}
