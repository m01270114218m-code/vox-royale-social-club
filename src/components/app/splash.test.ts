import { describe, expect, it } from "vitest";
import { SPLASH_SECONDS, splashAd } from "./splash";

const assets = [{ id: "a1", url: "https://x/ad.jpg", mime: "image/jpeg" }];

describe("opening ad", () => {
  it("stays for 5 seconds", () => { expect(SPLASH_SECONDS).toBe(5); });
  it("shows the image the admin chose when enabled", () => {
    expect(splashAd([{ key: "splash", value: { enabled: true, asset_id: "a1" } }], assets)).toEqual({ url: "https://x/ad.jpg", mime: "image/jpeg" });
  });
  it("shows nothing when turned off, unset or the file is gone", () => {
    expect(splashAd([{ key: "splash", value: { enabled: false, asset_id: "a1" } }], assets)).toBeNull();
    expect(splashAd([], assets)).toBeNull();
    expect(splashAd([{ key: "splash", value: { enabled: true, asset_id: "zz" } }], assets)).toBeNull();
  });
});
