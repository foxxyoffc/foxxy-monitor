import { and, desc, eq, max } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { canRestoreAdmin } from "../../shared/ownerControls";
import { z } from "zod";
import { activityLogs, blockedDevices, sessions, users } from "../../drizzle/schema";
import { getDb, logActivity } from "../db";
import { getRequestIp, hashPassword, maskIpHash } from "../security";
import { publicProcedure, router } from "../_core/trpc";
import { requireOwner, sessionInput } from "./guards";

export const adminRouter = router({
  list: publicProcedure.input(sessionInput).query(async ({ input }) => {
    await requireOwner(input.sessionToken);
    const db = await getDb();
    if (!db) return [];
    const admins = await db.select().from(users).where(eq(users.role, "admin")).orderBy(users.adminNumber);
    return admins.map(({ passwordHash, ...admin }) => ({ ...admin, ipDisplay: maskIpHash(admin.lastIpHash ?? "") }));
  }),
  create: publicProcedure.input(sessionInput.extend({ name: z.string().min(2).max(120), username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_.-]+$/).optional(), password: z.string().min(8).max(128).optional(), email: z.string().email().optional() }).refine((data) => Boolean(data.username || data.email), { message: "Masukkan username atau Gmail admin." }).refine((data) => !data.username || Boolean(data.password), { message: "Password wajib untuk username baru." })).mutation(async ({ input }) => {
    const owner = await requireOwner(input.sessionToken);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database belum tersedia." });
    if (input.username) {
      const exists = await db.select({ id: users.id }).from(users).where(eq(users.username, input.username)).limit(1);
      if (exists[0]) throw new TRPCError({ code: "CONFLICT", message: "Username telah digunakan." });
    }
    if (input.email) {
      const exists = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
      if (exists[0]) throw new TRPCError({ code: "CONFLICT", message: "Gmail telah terdaftar." });
    }
    const current = await db.select({ highest: max(users.adminNumber) }).from(users).where(eq(users.role, "admin"));
    const adminNumber = (current[0]?.highest ?? 0) + 1;
    const passwordHash = input.password ? await hashPassword(input.password) : null;
    const inserted = await db.insert(users).values({ openId: `admin:${input.username ?? input.email}`, username: input.username, passwordHash, name: input.name, email: input.email, role: "admin", adminNumber, loginMethod: passwordHash && input.email ? "both" : passwordHash ? "password" : "google" });
    const targetId = Number(inserted[0].insertId);
    await logActivity(owner.user.id, "ADMIN_CREATED", `Membuat Admin ${adminNumber}.`, targetId);
    return { success: true, adminNumber };
  }),
  blacklist: publicProcedure.input(sessionInput.extend({ adminId: z.number().int().positive(), reason: z.string().max(255).optional() })).mutation(async ({ input }) => {
    const owner = await requireOwner(input.sessionToken);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database belum tersedia." });
    const admin = (await db.select().from(users).where(and(eq(users.id, input.adminId), eq(users.role, "admin"))).limit(1))[0];
    if (!admin) throw new TRPCError({ code: "NOT_FOUND", message: "Admin tidak ditemukan." });
    if (!admin.lastDeviceHash || !admin.lastIpHash) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Admin ini belum pernah masuk dari perangkat yang dapat dicatat." });
    await db.insert(blockedDevices).values({ userId: admin.id, deviceHash: admin.lastDeviceHash, ipHash: admin.lastIpHash, blockedByUserId: owner.user.id, reason: input.reason ?? "Diblokir oleh Owner" }).onDuplicateKeyUpdate({ set: { reason: input.reason ?? "Diblokir oleh Owner" } });
    await db.update(users).set({ status: "blacklisted" }).where(eq(users.id, admin.id));
    await db.update(sessions).set({ isActive: false, revokedAt: new Date() }).where(and(eq(sessions.userId, admin.id), eq(sessions.isActive, true)));
    await logActivity(owner.user.id, "ADMIN_BLACKLISTED", `Memblokir perangkat Admin ${admin.adminNumber}.`, admin.id);
    return { success: true };
  }),
  unblacklist: publicProcedure.input(sessionInput.extend({ adminId: z.number().int().positive() })).mutation(async ({ input }) => {
    const owner = await requireOwner(input.sessionToken);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database belum tersedia." });
    const admin = (await db.select().from(users).where(and(eq(users.id, input.adminId), eq(users.role, "admin"))).limit(1))[0];
    if (!admin) throw new TRPCError({ code: "NOT_FOUND", message: "Admin tidak ditemukan." });
    if (!canRestoreAdmin(admin.status)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Hanya admin dengan status blacklisted yang dapat dipulihkan." });
    await db.delete(blockedDevices).where(eq(blockedDevices.userId, admin.id));
    await db.update(users).set({ status: "active" }).where(eq(users.id, admin.id));
    await logActivity(owner.user.id, "ADMIN_UNBLACKLISTED", `Menghapus blacklist untuk Admin ${admin.adminNumber}.`, admin.id);
    return { success: true };
  }),
  delete: publicProcedure.input(sessionInput.extend({ adminId: z.number().int().positive() })).mutation(async ({ input }) => {
    const owner = await requireOwner(input.sessionToken);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database belum tersedia." });
    const admin = (await db.select().from(users).where(and(eq(users.id, input.adminId), eq(users.role, "admin"))).limit(1))[0];
    if (!admin) throw new TRPCError({ code: "NOT_FOUND", message: "Admin tidak ditemukan." });
    await db.update(users).set({ status: "deleted" }).where(eq(users.id, admin.id));
    await db.update(sessions).set({ isActive: false, revokedAt: new Date() }).where(and(eq(sessions.userId, admin.id), eq(sessions.isActive, true)));
    await logActivity(owner.user.id, "ADMIN_DELETED", `Menghapus Admin ${admin.adminNumber}.`, admin.id);
    return { success: true };
  }),
  activity: publicProcedure.input(sessionInput).query(async ({ input }) => {
    await requireOwner(input.sessionToken);
    const db = await getDb();
    if (!db) return [];
    return db.select({ log: activityLogs, actor: users }).from(activityLogs).innerJoin(users, eq(activityLogs.actorUserId, users.id)).orderBy(desc(activityLogs.createdAt)).limit(200);
  }),
});
