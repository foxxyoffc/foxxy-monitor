import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const getDb = vi.fn(); const getSettings = vi.fn(); const logActivity = vi.fn(); const requireOwner = vi.fn(); const requireSession = vi.fn();
vi.mock("../db", () => ({ getDb, getSettings, logActivity, dashboardSummary: vi.fn() }));
vi.mock("./guards", () => ({ sessionInput: z.object({ sessionToken: z.string().min(20) }), requireOwner, requireSession }));
const { dashboardRouter } = await import("./dashboard");
const token = "q".repeat(24);

afterEach(() => { vi.restoreAllMocks(); getDb.mockReset(); getSettings.mockReset(); logActivity.mockReset(); requireOwner.mockReset(); requireSession.mockReset(); });

describe("dashboard workspace controls", () => {
  it("menghapus seluruh riwayat mutasi tabungan dan mencatat audit Owner", async () => {
    const db = { delete: vi.fn().mockResolvedValue({}) }; getDb.mockResolvedValue(db); requireOwner.mockResolvedValue({ user: { id: 4, role: "owner" } });
    await expect(dashboardRouter.createCaller({}).deleteSavingsHistory({ sessionToken: token })).resolves.toEqual({ success: true });
    expect(db.delete).toHaveBeenCalledTimes(1); expect(logActivity).toHaveBeenCalledWith(4, "SAVINGS_HISTORY_DELETED", "Menghapus seluruh riwayat mutasi tabungan.");
  });

  it("menghapus target beserta mutasinya dan mencatat audit Owner", async () => {
    const where = vi.fn().mockResolvedValue({}); const db = { delete: vi.fn(() => ({ where })) }; getDb.mockResolvedValue(db); requireOwner.mockResolvedValue({ user: { id: 4, role: "owner" } });
    await expect(dashboardRouter.createCaller({}).deleteSavingsPlan({ sessionToken: token, planId: 9 })).resolves.toEqual({ success: true });
    expect(db.delete).toHaveBeenCalledTimes(2); expect(where).toHaveBeenCalledTimes(2); expect(logActivity).toHaveBeenCalledWith(4, "SAVINGS_PLAN_DELETED", "Menghapus target tabungan #9 beserta riwayatnya.");
  });

  it("menyimpan tautan Kopi untuk Owner dan mengembalikan pengaturan terbaru", async () => {
    const onDuplicateKeyUpdate = vi.fn().mockResolvedValue({}); const db = { insert: vi.fn(() => ({ values: () => ({ onDuplicateKeyUpdate }) })) }; const settings = { id: 1, siteTitle: "Foxxy Monitor", ownerSociabuzzUrl: "https://sociabuzz.com/owner" };
    getDb.mockResolvedValue(db); getSettings.mockResolvedValue(settings); requireOwner.mockResolvedValue({ user: { id: 4, role: "owner" } });
    await expect(dashboardRouter.createCaller({}).updateOwnerLinks({ sessionToken: token, ownerSociabuzzUrl: settings.ownerSociabuzzUrl })).resolves.toEqual(settings);
    expect(onDuplicateKeyUpdate).toHaveBeenCalledTimes(1); expect(logActivity).toHaveBeenCalledWith(4, "OWNER_LINK_UPDATED", "Memperbarui tautan Kopi untuk Owner.");
  });

  it("mengembalikan hanya lagu yang mempunyai URL pratinjau resmi", async () => {
    requireSession.mockResolvedValue({ user: { id: 8, role: "admin" } }); vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [{ trackId: 1, trackName: "Track Siap Putar", artistName: "Artis", previewUrl: "https://audio.example/preview.m4a" }, { trackId: 2, trackName: "Tanpa Preview", artistName: "Artis" }] }) }));
    await expect(dashboardRouter.createCaller({}).searchMusic({ sessionToken: token, query: "track" })).resolves.toEqual([{ id: 1, title: "Track Siap Putar", artist: "Artis", album: "", artworkUrl: "", previewUrl: "https://audio.example/preview.m4a" }]);
  });
});
