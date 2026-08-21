import { describe, expect, it } from "vitest";
import { canAccessOwnerControl, isSessionAccepted } from "./access";

describe("role and session access rules", () => {
  it("mengizinkan kontrol owner hanya untuk role owner", () => {
    expect(canAccessOwnerControl("owner")).toBe(true);
    expect(canAccessOwnerControl("admin")).toBe(false);
    expect(canAccessOwnerControl("user")).toBe(false);
  });

  it("menolak sesi saat akun diblacklist, dihapus, atau token dicabut", () => {
    expect(isSessionAccepted(true, "active")).toBe(true);
    expect(isSessionAccepted(true, "blacklisted")).toBe(false);
    expect(isSessionAccepted(true, "deleted")).toBe(false);
    expect(isSessionAccepted(false, "active")).toBe(false);
  });
});
