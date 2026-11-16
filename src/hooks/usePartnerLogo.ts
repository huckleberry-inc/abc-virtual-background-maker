import { useEffect, useMemo, useState } from "react";
import config from "~/output.config.json";

import {
  PartnerLogoConfig,
  PartnerLogoPlacement,
  PartnerLogoSizes,
} from "@/constants";
import { findPartnerLogoPlacement, suggestPartnerLogoPlacement } from "@/utils";
import { PARTNER_LOGO_CANDIDATES } from "@/utils/partnerLogoPlacement";

/** Resolution used for analysing the background (16:9). */
const GRID_WIDTH = 160;
const GRID_HEIGHT = 90;
const DEFAULT_ASPECT = 2.4;

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
 * Resolves the best placement of the partner logo for a background:
 * a hand-tuned placement from the config when there is one, otherwise an
 * automatic one from analysing the image (works for uploaded images too).
 */
const usePartnerLogo = (src: string, occupied: Array<string>) => {
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);
  const [placement, setPlacement] = useState<PartnerLogoPlacement | null>(null);
  const occupiedKey = occupied.join(",");

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

  useEffect(() => {
    if (!partnerLogoConfig || !src) {
      setPlacement(null);
      return;
    }
    const blocked = occupiedKey.split(",");
    const tuned = findPartnerLogoPlacement(src, partnerLogoConfig.placements);
    const tunedIsUsable =
      tuned?.position !== undefined && !blocked.includes(tuned.position);
    if (tunedIsUsable && tuned?.size !== undefined) {
      setPlacement(tuned as PartnerLogoPlacement);
      return;
    }

    let ignore = false;
    loadImage(src)
      .then((img) => {
        const grid = readGrid(img);
        if (ignore || !grid) {
          return;
        }
        const { placement: suggested } = suggestPartnerLogoPlacement(
          grid,
          aspect,
          blocked,
        );
        setPlacement(tunedIsUsable ? { ...suggested, ...tuned } : suggested);
      })
      .catch(() => {
        // e.g. a cross-origin image without CORS headers
        !ignore && setPlacement(fallback);
      });
    return () => {
      ignore = true;
    };
  }, [src, occupiedKey, aspect, fallback]);

  return {
    config: partnerLogoConfig,
    aspect,
    placement: placement ?? fallback,
  };
};

export default usePartnerLogo;
