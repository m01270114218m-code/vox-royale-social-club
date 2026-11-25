import { describe, expect, it } from "vitest";
import { addStatTo, createAgencyFrom, defaultProfile, sumStats } from "./profile";
import { luckyRtp, pickLucky, LUCKY_BANNER_MIN_X } from "./lucky";
import { LUXURY_BANNER_MIN, giftTabs } from "./data";
import { TOAST_MS } from "./toast";

describe("lucky gifts", () => {
  it("long-run return to senders is 90%", () => expect(luckyRtp()).toBe(90));
  it("the best possible win is ×500", () => expect(pickLucky(0)).toBe(500));
  it("most draws return nothing", () => expect(pickLucky(0.99)).toBe(0));
  it("a lucky banner is shown from ×5 wins", () => expect(LUCKY_BANNER_MIN_X).toBe(5));
});

describe("gift banners", () => {
  it("gifts worth 5000 coins or more get the luxury banner", () => expect(LUXURY_BANNER_MIN).toBe(5000));
  it("the luxury tab only lists gifts of 1000 coins or more", () => expect(giftTabs.find((t) => t.k === "animated")!.list.every((g) => g.p >= 1000)).toBe(true));
});

describe("toasts", () => {
  it("disappear after one second", () => expect(TOAST_MS).toBe(1000));
});

describe("BD center", () => {
  it("cannot open an agency until BD is enabled by the admin", () => expect(createAgencyFrom(defaultProfile, "وكالة النجوم", "").r).toBe("disabled"));
  it("opens an agency once enabled", () => {
    const res = createAgencyFrom({ ...defaultProfile, bdEnabled: true }, "وكالة النجوم", "2281904");
    expect(res.r).toBe("ok");
    expect(res.patch?.agencies?.[0]?.agentUid).toBe("2281904");
  });
});

describe("host center stats", () => {
  it("adds mic time to today's total", () => {
    const p = { ...defaultProfile, ...addStatTo(defaultProfile, "mic", 300) };
    expect(sumStats(p, 1).mic).toBe(300);
  });
});
