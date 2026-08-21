import { and, eq, isNotNull, max } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { blockedDevices, sessions, users } from "../../drizzle/schema";
import { COOKIE_NAME } from "../../shared/const";
import { getDb, getSettings, logActivity } from "../db";
import { getSessionCookieOptions } from "../_core/cookies";
import { createSessionToken, getRequestIp, hashPassword, hashValue, verifyPassword } from "../security";
import { publicProcedure, router } from "../_core/trpc";
import { requireSession, sessionInput } from "./guards";

const credentials = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_.-]+$/, "Username hanya boleh huruf, angka, titik, garis bawah, atau strip."),
  password: z.string().min(8).max(128),
  deviceId: z.string().min(20).max(160),
});

async function startSession(userId: number, deviceId: string, ip: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database belum tersedia." });
  const token = createSessionToken();
  const deviceHash = hashValue(deviceId);
  const ipHash = hashValue(ip);
  await db.update(sessions).set({ isActive: false, revokedAt: new Date() }).where(and(eq(sessions.userId, userId), eq(sessions.isActive, true)));
  await db.insert(sessions).values({ userId, tokenHash: hashValue(token), deviceHash, ipHash });
  await db.update(users).set({ lastDeviceHash: deviceHash, lastIpHash: ipHash, lastSignedIn: new Date() }).where(eq(users.id, userId));
  return token;
}

async function assertNotBlocked(userId: number, deviceId: string, ip: string) {
  const db = await getDb();
  if (!db) return;
  const blocked = await db.select().from(blockedDevices).where(and(
    eq(blockedDevices.userId, userId),
    eq(blockedDevices.deviceHash, hashValue(deviceId)),
    eq(blockedDevices.ipHash, hashValue(ip)),
  )).limit(1);
  if (blocked[0]) throw new TRPCError({ code: "FORBIDDEN", message: "Perangkat ini telah diblokir oleh Owner." });
}

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.user),
  hasOwner: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { hasOwner: false };
    const owner = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "owner"), isNotNull(users.username))).limit(1);
    return { hasOwner: Boolean(owner[0]) };
  }),
  settings: publicProcedure.query(async () => getSettings()),
  bootstrapOwner: publicProcedure.input(credentials.extend({ name: z.string().min(2).max(120), email: z.string().email().optional() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database belum tersedia." });
    const owner = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "owner"), isNotNull(users.username))).limit(1);
    if (owner[0]) throw new TRPCError({ code: "CONFLICT", message: "Owner sudah dibuat. Silakan masuk." });
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, input.username)).limit(1);
    if (existing[0]) throw new TRPCError({ code: "CONFLICT", message: "Username sudah digunakan." });
    const passwordHash = await hashPassword(input.password);
    const created = await db.insert(users).values({ openId: `local:${input.username}`, username: input.username, passwordHash, name: input.name, email: input.email, role: "owner", loginMethod: "both" });
    const ownerId = Number(created[0].insertId);
    const token = await startSession(ownerId, input.deviceId, getRequestIp(ctx.req.headers));
    await logActivity(ownerId, "OWNER_CREATED", "Owner pertama berhasil menyiapkan Foxxy Monitor.");
    return { sessionToken: token, user: { id: ownerId, name: input.name, role: "owner" as const } };
  }),
  login: publicProcedure.input(credentials).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database belum tersedia." });
    const user = (await db.select().from(users).where(eq(users.username, input.username)).limit(1))[0];
    if (!user || !user.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Username atau password tidak valid." });
    }
    if (user.status !== "active") throw new TRPCError({ code: "FORBIDDEN", message: "Akun ini tidak lagi aktif." });
    const ip = getRequestIp(ctx.req.headers);
    await assertNotBlocked(user.id, input.deviceId, ip);
    const token = await startSession(user.id, input.deviceId, ip);
    await logActivity(user.id, "LOGIN_PASSWORD", "Masuk menggunakan username dan password.");
    return { sessionToken: token, user: { id: user.id, name: user.name ?? "Pengguna", role: user.role, adminNumber: user.adminNumber } };
  }),
  googleLogin: publicProcedure.input(z.object({ idToken: z.string().min(100), deviceId: z.string().min(20).max(160) })).mutation(async ({ input, ctx }) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Login Google belum dikonfigurasi oleh Owner." });
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(input.idToken)}`);
    if (!response.ok) throw new TRPCError({ code: "UNAUTHORIZED", message: "Token Google tidak valid." });
    const profile = await response.json() as { aud?: string; sub?: string; email?: string; email_verified?: string };
    if (profile.aud !== clientId || !profile.sub || !profile.email || profile.email_verified !== "true") throw new TRPCError({ code: "UNAUTHORIZED", message: "Akun Google tidak dapat diverifikasi." });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database belum tersedia." });
    const user = (await db.select().from(users).where(eq(users.email, profile.email)).limit(1))[0];
    if (!user || user.status !== "active") throw new TRPCError({ code: "FORBIDDEN", message: "Gmail ini belum terdaftar atau tidak lagi aktif." });
    const ip = getRequestIp(ctx.req.headers);
    await assertNotBlocked(user.id, input.deviceId, ip);
    await db.update(users).set({ googleSubject: profile.sub, loginMethod: user.passwordHash ? "both" : "google" }).where(eq(users.id, user.id));
    const token = await startSession(user.id, input.deviceId, ip);
    await logActivity(user.id, "LOGIN_GOOGLE", "Masuk menggunakan Google.");
    return { sessionToken: token, user: { id: user.id, name: user.name ?? "Pengguna", role: user.role, adminNumber: user.adminNumber } };
  }),
  validate: publicProcedure.input(sessionInput).query(async ({ input }) => {
    const authorized = await requireSession(input.sessionToken);
    return { active: true, user: { id: authorized.user.id, name: authorized.user.name, email: authorized.user.email, role: authorized.user.role, adminNumber: authorized.user.adminNumber } };
  }),
  revokeSession: publicProcedure.input(sessionInput).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: true };
    await db.update(sessions).set({ isActive: false, revokedAt: new Date() }).where(eq(sessions.tokenHash, hashValue(input.sessionToken)));
    return { success: true };
  }),
  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
    return { success: true };
  }),
});
