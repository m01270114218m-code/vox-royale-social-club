import { describe, expect, it } from "vitest";
import { DAILY_REWARDS, DAILY_VIP_DAYS, DAY_MS, dailyDue, nextDailyDay, stillValid } from "./daily";
import { backStep } from "./back";

const t0 = Date.parse("2026-11-25T00:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();

describe("daily sign-in card", () => {
  it("gives the seven rewards the owner asked for", () => {
    expect(DAILY_REWARDS).toEqual([
      { coins: 15000, vip: 0 }, { coins: 20000, vip: 0 }, { coins: 0, vip: 2 }, { coins: 0, vip: 3 },
      { coins: 15000, vip: 3 }, { coins: 0, vip: 5 }, { coins: 20000, vip: 5 },
    ]);
  });
  it("daily VIP lasts one day", () => expect(DAILY_VIP_DAYS).toBe(1));
  it("appears only once every 24 hours", () => {
    expect(dailyDue(null, t0)).toBe(true);
    expect(dailyDue(iso(t0 - DAY_MS + 60000), t0)).toBe(false);
    expect(dailyDue(iso(t0 - DAY_MS), t0)).toBe(true);
  });
  it("moves to the next day and restarts after day 7 or a missed day", () => {
    expect(nextDailyDay(0, null, t0)).toBe(1);
    expect(nextDailyDay(3, iso(t0 - DAY_MS), t0)).toBe(4);
    expect(nextDailyDay(7, iso(t0 - DAY_MS), t0)).toBe(1);
    expect(nextDailyDay(3, iso(t0 - 3 * DAY_MS), t0)).toBe(1);
  });
});
describe("timed items", () => {
  it("expire at their end date and permanent ones never do", () => {
    expect(stillValid(null, t0)).toBe(true);
    expect(stillValid(iso(t0 + 1000), t0)).toBe(true);
    expect(stillValid(iso(t0 - 1000), t0)).toBe(false);
  });
});
describe("phone back button", () => {
  it("goes back one page instead of closing the app", () => {
    expect(backStep({ hasSheet: false, path: "/wallet", canGoBack: true, pressedRecently: false })).toBe("back");
    expect(backStep({ hasSheet: false, path: "/wallet", canGoBack: false, pressedRecently: false })).toBe("home");
  });
  it("closes an open sheet first", () => expect(backStep({ hasSheet: true, path: "/room/1", canGoBack: true, pressedRecently: false })).toBe("close"));
  it("exits from home only on a second press", () => {
    expect(backStep({ hasSheet: false, path: "/", canGoBack: true, pressedRecently: false })).toBe("exit-hint");
    expect(backStep({ hasSheet: false, path: "/", canGoBack: true, pressedRecently: true })).toBe("exit");
  });
});
