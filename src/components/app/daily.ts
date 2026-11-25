/** Daily sign-in rewards (day 1..7). Mirrors the `daily` action in the database. */
export const DAILY_REWARDS: readonly { coins: number; vip: number }[] = [
  { coins: 15000, vip: 0 },
  { coins: 20000, vip: 0 },
  { coins: 0, vip: 2 },
  { coins: 0, vip: 3 },
  { coins: 15000, vip: 3 },
  { coins: 0, vip: 5 },
  { coins: 20000, vip: 5 },
];
/** How long a VIP won from the daily card lasts. */
export const DAILY_VIP_DAYS = 1;
export const DAY_MS = 24 * 60 * 60 * 1000;
/** A reward can be claimed (and the card shown) only once every 24 hours. */
export const dailyDue = (lastAt: string | null | undefined, now: number) => !lastAt || now - Date.parse(lastAt) >= DAY_MS;
/** Which day comes next; the streak restarts after day 7 or after missing more than 48 hours. */
export const nextDailyDay = (day: number, lastAt: string | null | undefined, now: number) =>
  !lastAt || now - Date.parse(lastAt) > 2 * DAY_MS || day >= 7 ? 1 : day + 1;
/** True while a timed thing (item, VIP, publication) is still valid; null means forever. */
export const stillValid = (until: string | null | undefined, now: number) => !until || Date.parse(until) > now;
/** "دائم" or the remaining days/hours of a timed item. */
export function remainingLabel(until: string | null | undefined, now: number): string {
  if (!until) return "دائم";
  const ms = Date.parse(until) - now;
  if (ms <= 0) return "منتهي";
  return ms >= DAY_MS ? `${Math.ceil(ms / DAY_MS)} يوم` : `${Math.max(1, Math.ceil(ms / 3600000))} ساعة`;
}
