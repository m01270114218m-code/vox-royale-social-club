import { describe, expect, it } from "vitest";
import { nextSlide } from "./BannerCarousel";

describe("banner rotation", () => {
  it("moves to the next banner and wraps back to the first", () => {
    expect(nextSlide(0, 3)).toBe(1);
    expect(nextSlide(2, 3)).toBe(0);
  });
  it("stays put with a single banner", () => { expect(nextSlide(0, 1)).toBe(0); });
});
