import { describe, expect, it } from "vitest";
import { buyResult, defaultProfile, equipPatch } from "./profile";
import { storeItems } from "./data";

const item = (key: string) => storeItems.find((i) => i.key === key)!;

describe("store purchases", () => {
  it("cannot buy an item costing more than the balance", () => {
    expect(buyResult({ ...defaultProfile, coins: 1000 }, item("frame:wings"))).toBe("poor");
  });
  it("an already owned item is not charged again", () => {
    expect(buyResult({ ...defaultProfile, owned: ["frame:ice"] }, item("frame:ice"))).toBe("owned");
  });
  it("buying a special ID equips that colored ID", () => {
    expect(equipPatch(item("sid:8888"))).toEqual({ sid: "8888" });
  });
});
