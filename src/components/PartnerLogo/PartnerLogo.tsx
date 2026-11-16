import { PartnerLogoPlacement } from "@/constants";
import { getPartnerLogoRect } from "@/utils";
import styles from "./PartnerLogo.module.scss";

interface Props {
  src: string;
  alt?: string;
  aspect: number;
  placement: PartnerLogoPlacement;
}

/**
 * The partner badge is drawn as-is (no recolouring), as the partner badge
 * guidelines forbid altering its colour, proportions or design.
 */
const PartnerLogo = ({ src, alt = "", aspect, placement }: Props) => {
  const { left, top, width, height } = getPartnerLogoRect(placement, aspect);
  const toPercent = (value: number) => `${(value * 100).toFixed(3)}%`;

  return (
    <img
      className={styles.logo}
      src={src}
      alt={alt}
      draggable={false}
      style={{
        left: toPercent(left),
        top: toPercent(top),
        width: toPercent(width),
        height: toPercent(height),
      }}
    />
  );
};

export default PartnerLogo;
