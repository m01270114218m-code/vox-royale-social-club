import { describe, expect, it } from "vitest";
import { luckyPayoutPct, luckyTier, luxuryTier } from "./banners";

describe("gift banner tiers", () => {
  it("luxury banner starts at 5,000 coins", () => {
    expect(luxuryTier(4999)).toBeNull();
    expect(luxuryTier(5000)).toBe("gold");
  });
  it("royal tier from 20,000 and legend from 100,000", () => {
    expect(luxuryTier(19999)).toBe("gold");
    expect(luxuryTier(20000)).toBe("royal");
    expect(luxuryTier(100000)).toBe("legend");
  });
  it("lucky banner starts at ×5, super at ×50, jackpot at ×200", () => {
    expect(luckyTier(2)).toBeNull();
    expect(luckyTier(5)).toBe("lucky");
    expect(luckyTier(50)).toBe("super");
    expect(luckyTier(500)).toBe("jackpot");
  });
  it("lucky payout percent is multiplier × 100", () => {
    expect(luckyPayoutPct(5)).toBe(500);
    expect(luckyPayoutPct(500)).toBe(50000);
  });
});
