import { useCallback, useEffect, useMemo, useState } from "react";
import config from "~/output.config.json";

import {
  PartnerLogoConfig,
  PartnerLogoPlacement,
  PartnerLogoSizes,
} from "@/constants";
import {
  findPartnerLogoPlacement,
  getPartnerLogoRect,
  getRegionLuminance,
  suggestPartnerLogoPlacement,
} from "@/utils";
import { PARTNER_LOGO_CANDIDATES } from "@/utils/partnerLogoPlacement";

/** Resolution used for analysing the background (16:9). */
const GRID_WIDTH = 160;
const GRID_HEIGHT = 90;
const DEFAULT_ASPECT = 2.81;
/** Below this mean luminance (0-1) the logo area counts as dark. */
const DARK_LUMINANCE = 0.45;

export const partnerLogoConfig = (config as { partnerLogo?: PartnerLogoConfig })
  .partnerLogo;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/** Draws the image the same way the editor shows it (object-fit: cover). */
const readGrid = (img: HTMLImageElement) => {
  const canvas = document.createElement("canvas");
  canvas.width = GRID_WIDTH;
  canvas.height = GRID_HEIGHT;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }
  const scale = Math.max(
    GRID_WIDTH / img.naturalWidth,
    GRID_HEIGHT / img.naturalHeight,
  );
  const width = img.naturalWidth * scale;
  const height = img.naturalHeight * scale;
  context.drawImage(
    img,
    (GRID_WIDTH - width) / 2,
    (GRID_HEIGHT - height) / 2,
    width,
    height,
  );
  return context.getImageData(0, 0, GRID_WIDTH, GRID_HEIGHT);
};

/**
 * Corners the logo must not use because text fields sit there. A text field
 * group on a corner blocks that corner; custom positions (e.g. "hb-2025-1")
 * block the corners listed in `partnerLogo.avoid` under a matching prefix.
 */
const getOccupiedCorners = (textPositions: Array<string>) => {
  const avoid = partnerLogoConfig?.avoid ?? {};
  const corners = new Set<string>();
  textPositions.forEach((position) => {
    if ((PARTNER_LOGO_CANDIDATES as Array<string>).includes(position)) {
      corners.add(position);
    }
    Object.entries(avoid)
      .filter(([prefix]) => position.startsWith(prefix))
      .forEach(([, blocked]) => blocked.forEach((c) => corners.add(c)));
  });
  return [...corners].sort();
};

/**
 * Resolves the best placement of the partner logo for a background:
 * a hand-tuned placement from the config when there is one, otherwise an
 * automatic one from analysing the image (works for uploaded images too).
 * Also tells whether the area under the logo is dark, so the dark variant
 * (light text, no tile) can be used there.
 */
const usePartnerLogo = (src: string, textPositions: Array<string>) => {
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);
  const [grid, setGrid] = useState<ImageData | null>(null);
  const [gridFailed, setGridFailed] = useState(false);
  const occupiedKey = getOccupiedCorners(textPositions).join(",");

  useEffect(() => {
    if (!partnerLogoConfig?.src) {
      return;
    }
    let ignore = false;
    loadImage(partnerLogoConfig.src)
      .then(({ naturalWidth, naturalHeight }) => {
        if (!ignore && naturalWidth > 0 && naturalHeight > 0) {
          setAspect(naturalWidth / naturalHeight);
        }
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    setGrid(null);
    setGridFailed(false);
    if (!partnerLogoConfig || !src) {
      return;
    }
    let ignore = false;
    loadImage(src)
      .then((img) => {
        if (!ignore) {
          const data = readGrid(img);
          setGrid(data);
          setGridFailed(!data);
        }
      })
      .catch(() => {
        // e.g. a cross-origin image without CORS headers
        !ignore && setGridFailed(true);
      });
    return () => {
      ignore = true;
    };
  }, [src]);

  const fallback = useMemo<PartnerLogoPlacement>(() => {
    const blocked = occupiedKey.split(",");
    return {
      position:
        PARTNER_LOGO_CANDIDATES.find(
          (position) => !blocked.includes(position),
        ) ?? "top-right",
      size: PartnerLogoSizes.medium,
    };
  }, [occupiedKey]);

  const placement = useMemo<PartnerLogoPlacement | null>(() => {
    if (!partnerLogoConfig || !src) {
      return null;
    }
    const blocked = occupiedKey.split(",");
    const tuned = findPartnerLogoPlacement(src, partnerLogoConfig.placements);
    const tunedIsUsable =
      tuned?.position !== undefined && !blocked.includes(tuned.position);
    if (tunedIsUsable && tuned?.size !== undefined) {
      return tuned as PartnerLogoPlacement;
    }
    if (!grid) {
      return gridFailed ? fallback : null;
    }
    const { placement: suggested } = suggestPartnerLogoPlacement(
      grid,
      aspect,
      blocked,
    );
    return tunedIsUsable ? { ...suggested, ...tuned } : suggested;
  }, [src, occupiedKey, grid, gridFailed, aspect, fallback]);

  /** Whether the background under the logo at `target` is dark. */
  const isDarkAt = useCallback(
    (target: PartnerLogoPlacement) =>
      grid !== null &&
      getRegionLuminance(grid, getPartnerLogoRect(target, aspect)) <
        DARK_LUMINANCE,
    [grid, aspect],
  );

  return {
    config: partnerLogoConfig,
    aspect,
    placement: placement ?? fallback,
    isDarkAt,
  };
};

export default usePartnerLogo;
