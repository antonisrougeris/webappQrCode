/**
 * SKANARE T-shirt fit guide.
 * Dimensions are flat garment measurements supplied by the merchant, NOT
 * body measurements. Height/weight alone cannot establish precise fit.
 * This is a deliberately conservative, on-device starting suggestion.
 */
export const SKANARE_TSHIRT_SIZES = [
  { size: "S", lengthCm: 64, widthCm: 48 },
  { size: "M", lengthCm: 70, widthCm: 50 },
  { size: "L", lengthCm: 72, widthCm: 53 },
  { size: "XL", lengthCm: 74, widthCm: 56 },
  { size: "2XL", lengthCm: 76, widthCm: 59 },
] as const;

export type TshirtSize = (typeof SKANARE_TSHIRT_SIZES)[number]["size"];
export type FitPreference = "fitted" | "regular" | "relaxed";

/**
 * Initial heuristic calibration based on merchant fit examples, not on real
 * return/fit observations. Height drives garment length; weight is a smaller
 * modifier because it is not a chest circumference measurement. The apparent
 * accuracy of this scoring is intentionally NOT presented to customers.
 *
 * Both samples are in SKANARE marketed-label sizes (not SOL'S blank labels):
 * 175cm / 70kg / regular -> L
 * 170cm / 80kg / regular -> M
 *
 * Smooth score avoids BMI thresholds where a 1kg difference jumps a size.
 * Around rounding boundaries we show an adjacent alternative instead of
 * implying an exact answer.
 */
export interface TshirtFitEstimate {
  size: TshirtSize;
  alternative: TshirtSize | null;
  nearBoundary: boolean;
}

export function estimateTshirtFit(
  heightCm: number,
  weightKg: number,
  fit: FitPreference = "regular"
): TshirtFitEstimate | null {
  if (!Number.isFinite(heightCm) || !Number.isFinite(weightKg) ||
      heightCm < 145 || heightCm > 205 || weightKg < 40 || weightKg > 150 ||
      !["fitted", "regular", "relaxed"].includes(fit)) return null;

  const bmi = weightKg / ((heightCm / 100) ** 2);
  if (bmi < 16 || bmi > 34) return null;

  // One unit means one step in the SKANARE labeled size range S-2XL.
  // Calibrated on the two examples; intentionally no abrupt height/BMI bands.
  const fitShift = fit === "fitted" ? -0.65 : fit === "relaxed" ? 0.65 : 0;
  const score = 1 + 0.24 * (heightCm - 170) + 0.03 * (weightKg - 80) + fitShift;
  const best = Math.max(0, Math.min(SKANARE_TSHIRT_SIZES.length - 1, Math.round(score)));
  const lower = Math.floor(score);
  const fraction = score - lower;
  const nearBoundary = lower >= 0 &&
    lower < SKANARE_TSHIRT_SIZES.length - 1 &&
    Math.abs(fraction - 0.5) <= 0.18;
  const alternativeIndex = nearBoundary
    ? (best === lower ? lower + 1 : lower)
    : null;

  return {
    size: SKANARE_TSHIRT_SIZES[best].size,
    alternative: alternativeIndex === null ? null : SKANARE_TSHIRT_SIZES[alternativeIndex].size,
    nearBoundary,
  };
}

/** Backwards-compatible simple lookup for other consumers. */
export function estimateTshirtSize(
  heightCm: number,
  weightKg: number,
  fit: FitPreference = "regular"
): TshirtSize | null {
  return estimateTshirtFit(heightCm, weightKg, fit)?.size || null;
}
