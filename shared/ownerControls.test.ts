import { describe, expect, it } from "vitest";
import { allResetConfirmation, calculateSavingsBalance, calculateSavingsProgress, canRestoreAdmin, monthlyResetConfirmation } from "./ownerControls";

describe("owner controls", () => {
  it("menerima hanya frasa konfirmasi reset yang tepat", () => {
    expect(monthlyResetConfirmation.safeParse("RESET BULANAN").success).toBe(true);
    expect(monthlyResetConfirmation.safeParse("reset bulanan").success).toBe(false);
    expect(allResetConfirmation.safeParse("RESET SEMUA").success).toBe(true);
    expect(allResetConfirmation.safeParse("RESET ALL").success).toBe(false);
  });

  it("memulihkan hanya admin yang memang sedang diblacklist", () => {
    expect(canRestoreAdmin("blacklisted")).toBe(true);
    expect(canRestoreAdmin("active")).toBe(false);
    expect(canRestoreAdmin("deleted")).toBe(false);
  });

  it("menghitung saldo dan kemajuan target tabungan dari setoran serta pengeluaran", () => {
    const balance = calculateSavingsBalance([{ type: "deposit", amount: 800_000 }, { type: "withdrawal", amount: 125_000 }, { type: "deposit", amount: 325_000 }]);
    expect(balance).toBe(1_000_000);
    expect(calculateSavingsProgress(balance, 2_000_000)).toBe(50);
    expect(calculateSavingsProgress(3_000_000, 2_000_000)).toBe(100);
  });
});
