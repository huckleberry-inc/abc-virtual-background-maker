export const PartnerLogoPositions = {
  "top-left": "Top Left",
  "top-right": "Top Right",
  "bottom-left": "Bottom Left",
  "bottom-right": "Bottom Right",
} as const;

export type PartnerLogoPosition = keyof typeof PartnerLogoPositions;

export const PartnerLogoSizes = {
  small: 0.065,
  medium: 0.08,
  large: 0.095,
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

export interface PartnerLogoConfig {
  src: string;
  alt?: string;
  isVisible?: boolean;
  /**
   * Hand-tuned placements per background. The key is matched against the end of
   * the background `src` (e.g. "office/01.jpg").
   */
  placements?: Record<string, Partial<PartnerLogoPlacement>>;
}
