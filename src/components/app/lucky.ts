/** Lucky gift payout table: multiplier of the gift's cost returned to the sender, with weight out of 100. */
export const luckyTable: { x: number; w: number }[] = [
  { x: 500, w: 0.02 },
  { x: 50, w: 0.3 },
  { x: 10, w: 2 },
  { x: 5, w: 3 },
  { x: 2, w: 5 },
  { x: 1, w: 20 },
  { x: 0, w: 69.68 },
];

/** Long-run share of coins returned to senders, in percent. */
export function luckyRtp(): number {
  const total = luckyTable.reduce((s, r) => s + r.w, 0);
  return Math.round((luckyTable.reduce((s, r) => s + r.x * r.w, 0) / total) * 100);
}

/** Pick a multiplier from a random number in [0, 1). */
export function pickLucky(rand: number): number {
  const total = luckyTable.reduce((s, r) => s + r.w, 0);
  let t = rand * total;
  for (const r of luckyTable) {
    if (t < r.w) return r.x;
    t -= r.w;
  }
  return 0;
}

/** Banner is shown for a lucky win of at least this multiplier. */
export const LUCKY_BANNER_MIN_X = 5;
