import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

const getDb = vi.fn();
const logActivity = vi.fn();
const requireOwner = vi.fn();

vi.mock("../db", () => ({ getDb, logActivity }));
vi.mock("./guards", () => ({ sessionInput: z.object({ sessionToken: z.string().min(20) }), requireOwner }));

const { adminRouter } = await import("./admin");

function unblacklistDb(status: "active" | "blacklisted" | "deleted") {
  const select = vi.fn(() => ({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([{ id: 12, role: "admin", adminNumber: 2, status }]) }) }) }));
  const deleteWhere = vi.fn().mockResolvedValue({}); const updateWhere = vi.fn().mockResolvedValue({});
  return { select, delete: vi.fn(() => ({ where: deleteWhere })), update: vi.fn(() => ({ set: () => ({ where: updateWhere }) })), deleteWhere, updateWhere };
}

describe("admin unblacklist procedure", () => {
  it("menghapus blokir perangkat, memulihkan status, dan mencatat audit untuk admin blacklisted", async () => {
    const db = unblacklistDb("blacklisted"); getDb.mockResolvedValue(db); requireOwner.mockResolvedValue({ user: { id: 1, role: "owner" } });
    const result = await adminRouter.createCaller({}).unblacklist({ sessionToken: "z".repeat(24), adminId: 12 });
    expect(result).toEqual({ success: true }); expect(db.delete).toHaveBeenCalledTimes(1); expect(db.update).toHaveBeenCalledTimes(1);
    expect(logActivity).toHaveBeenCalledWith(1, "ADMIN_UNBLACKLISTED", "Menghapus blacklist untuk Admin 2.", 12);
  });

  it("menolak pemulihan admin yang tidak berada dalam blacklist", async () => {
    const db = unblacklistDb("active"); getDb.mockResolvedValue(db); requireOwner.mockResolvedValue({ user: { id: 1, role: "owner" } });
    await expect(adminRouter.createCaller({}).unblacklist({ sessionToken: "w".repeat(24), adminId: 12 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.delete).not.toHaveBeenCalled();
  });
});
