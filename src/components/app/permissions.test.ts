import { describe, expect, it } from "vitest";
import { can } from "./permissions";

describe("room permissions", () => {
  it("owner can kick an admin from the room", () => expect(can("owner", "kickFromRoom", "admin")).toBe(true));
  it("nobody can kick the owner", () => {
    expect(can("owner", "kickFromRoom", "owner")).toBe(false);
    expect(can("admin", "kickFromRoom", "owner")).toBe(false);
  });
  it("admin can mute a member but not another admin", () => {
    expect(can("admin", "mute", "member")).toBe(true);
    expect(can("admin", "mute", "admin")).toBe(false);
  });
  it("only the owner can appoint admins", () => {
    expect(can("owner", "setAdmin", "member")).toBe(true);
    expect(can("admin", "setAdmin", "member")).toBe(false);
  });
  it("members cannot lock seats or remove anyone from the mic", () => {
    expect(can("member", "lockSeat")).toBe(false);
    expect(can("member", "kickFromMic", "member")).toBe(false);
  });
  it("admin can lock seats and clear chat but cannot mute everyone", () => {
    expect(can("admin", "lockSeat")).toBe(true);
    expect(can("admin", "clearChat")).toBe(true);
    expect(can("admin", "muteAll")).toBe(false);
  });
});
