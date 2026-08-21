import { describe, expect, it } from "vitest";
import { createSessionToken, hashPassword, hashValue, verifyPassword } from "./security";

describe("security helpers", () => {
  it("membuat hash stabil untuk nilai yang sama", () => {
    expect(hashValue("device-foxxy")).toBe(hashValue("device-foxxy"));
    expect(hashValue("device-foxxy")).not.toBe(hashValue("device-lain"));
  });

  it("memverifikasi password yang tepat dan menolak password yang berbeda", async () => {
    const stored = await hashPassword("SandiAman123");
    await expect(verifyPassword("SandiAman123", stored)).resolves.toBe(true);
    await expect(verifyPassword("SandiSalah123", stored)).resolves.toBe(false);
  });

  it("membuat token sesi panjang yang unik", () => {
    const first = createSessionToken();
    const second = createSessionToken();
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThan(40);
  });
});
