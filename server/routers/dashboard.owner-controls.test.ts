import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

const getDb = vi.fn();
const logActivity = vi.fn();
const requireOwner = vi.fn();

vi.mock("../db", () => ({ getDb, logActivity, dashboardSummary: vi.fn(), getSettings: vi.fn() }));
vi.mock("./guards", () => ({ sessionInput: z.object({ sessionToken: z.string().min(20) }), requireOwner, requireSession: vi.fn() }));

const { dashboardRouter } = await import("./dashboard");

describe("dashboard owner reset procedures", () => {
  it("menghapus metrik pada bulan terpilih dan mencatat audit reset bulanan", async () => {
    const where = vi.fn().mockResolvedValue({});
    const db = { delete: vi.fn(() => ({ where })) };
    getDb.mockResolvedValue(db); requireOwner.mockResolvedValue({ user: { id: 7, role: "owner" } });
    const result = await dashboardRouter.createCaller({}).resetMonthlyMetrics({ sessionToken: "x".repeat(24), month: "2026-08", confirmation: "RESET BULANAN" });
    expect(result).toEqual({ success: true }); expect(db.delete).toHaveBeenCalledTimes(1); expect(where).toHaveBeenCalledTimes(1);
    expect(logActivity).toHaveBeenCalledWith(7, "MONTHLY_METRICS_RESET", "Mereset transaksi untuk 2026-08.");
  });

  it("menghapus seluruh metrik transaksi dan mencatat audit reset all", async () => {
    const db = { delete: vi.fn().mockResolvedValue({}) };
    getDb.mockResolvedValue(db); requireOwner.mockResolvedValue({ user: { id: 7, role: "owner" } });
    const result = await dashboardRouter.createCaller({}).resetAllMetrics({ sessionToken: "y".repeat(24), confirmation: "RESET SEMUA" });
    expect(result).toEqual({ success: true }); expect(db.delete).toHaveBeenCalledTimes(1);
    expect(logActivity).toHaveBeenCalledWith(7, "ALL_METRICS_RESET", "Mereset seluruh data transaksi aplikasi.");
  });
});
