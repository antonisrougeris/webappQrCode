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
 * No training data or size-return statistics are available for this brand.
 * Never claim a probability/AI accuracy; all sizes use merchant-supplied garment measurements.
 */
export function estimateTshirtSize(
  heightCm: number,
  weightKg: number,
  fit: FitPreference = "regular"
): TshirtSize | null {
  if (!Number.isFinite(heightCm) || !Number.isFinite(weightKg) ||
      heightCm < 145 || heightCm > 205 || weightKg < 40 || weightKg > 150 ||
      !["fitted", "regular", "relaxed"].includes(fit)) return null;

  const bmi = weightKg / ((heightCm / 100) ** 2);
  // Extreme combinations are outside the range where this simple heuristic
  // could provide a useful recommendation; ask for garment measurements.
  if (bmi < 16 || bmi > 34) return null;

  const byHeight = heightCm < 167 ? 0 : heightCm < 176 ? 1 : heightCm < 185 ? 2 : 3;
  const buildAdjustment = bmi < 19 ? -1 : bmi >= 28 ? 1 : 0;
  const preferenceAdjustment = fit === "fitted" ? -1 : fit === "relaxed" ? 1 : 0;
  const index = byHeight + buildAdjustment + preferenceAdjustment;
  if (index > SKANARE_TSHIRT_SIZES.length - 1) return null;
  return SKANARE_TSHIRT_SIZES[Math.max(0, index)].size;
}
