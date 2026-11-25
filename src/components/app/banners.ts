/** Room-wide gift banner tiers. Pure rules, no React. */
import { LUXURY_BANNER_MIN } from "./data";
import { LUCKY_BANNER_MIN_X } from "./lucky";

export type LuxuryTier = "gold" | "royal" | "legend";
export type LuckyTier = "lucky" | "super" | "jackpot";

/** Total value thresholds (coins) for each luxury banner tier. */
export const LUXURY_TIERS: { t: LuxuryTier; min: number; label: string }[] = [
  { t: "legend", min: 100000, label: "هدية أسطورية" },
  { t: "royal", min: 20000, label: "هدية ملكية" },
  { t: "gold", min: LUXURY_BANNER_MIN, label: "هدية فاخرة" },
];

/** Win multiplier thresholds for each lucky banner tier. */
export const LUCKY_TIERS: { t: LuckyTier; min: number; label: string }[] = [
  { t: "jackpot", min: 200, label: "الجائزة الكبرى" },
  { t: "super", min: 50, label: "فوز خارق" },
  { t: "lucky", min: LUCKY_BANNER_MIN_X, label: "هدية الحظ" },
];

/** Luxury tier for a gift's total value, or null when no banner is shown. */
export function luxuryTier(value: number): LuxuryTier | null {
  return LUXURY_TIERS.find((x) => value >= x.min)?.t ?? null;
}

/** Lucky tier for a win multiplier, or null when no banner is shown. */
export function luckyTier(x: number): LuckyTier | null {
  return LUCKY_TIERS.find((r) => x >= r.min)?.t ?? null;
}

export const tierLabel = (t: LuxuryTier | LuckyTier): string =>
  [...LUXURY_TIERS, ...LUCKY_TIERS].find((x) => x.t === t)!.label;

/** Payout percent shown on a lucky banner: ×5 returns 500% of the gift's cost. */
export const luckyPayoutPct = (x: number): number => Math.round(x * 100);
