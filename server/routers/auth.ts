import { and, eq, isNotNull, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { blockedDevices, sessions, users } from "../../drizzle/schema";
import { COOKIE_NAME } from "../../shared/const";
import { getDb, getSettings, logActivity } from "../db";
import { getSessionCookieOptions } from "../_core/cookies";
import { ENV } from "../_core/env";
import { createSessionToken, getRequestIp, hashPassword, hashValue, verifyPassword } from "../security";
import { publicProcedure, router } from "../_core/trpc";
import { requireOwner, requireSession, sessionInput } from "./guards";

const credentials = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_.-]+$/, "Username hanya boleh huruf, angka, titik, garis bawah, atau strip."),
  password: z.string().min(8).max(128),
  deviceId: z.string().min(20).max(160),
});

const ENVIRONMENT_OWNER_OPEN_ID = "owner:vercel";

function hasEnvironmentOwnerCredentials() {
  return Boolean(ENV.ownerUsername && ENV.ownerPassword);
}

async function ensureEnvironmentOwner(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const current = (await db.select().from(users).where(eq(users.openId, ENVIRONMENT_OWNER_OPEN_ID)).limit(1))[0];
  if (current) {
    await db.update(users).set({ role: "owner", status: "active", name: "Owner" }).where(eq(users.id, current.id));
    return (await db.select().from(users).where(eq(users.id, current.id)).limit(1))[0]!;
  }
  const inserted = await db.insert(users).values({ openId: ENVIRONMENT_OWNER_OPEN_ID, name: "Owner", role: "owner", loginMethod: "environment" });
  return (await db.select().from(users).where(eq(users.id, Number(inserted[0].insertId))).limit(1))[0]!;
}

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
  ownerCredentialMode: publicProcedure.query(() => ({ environmentManaged: hasEnvironmentOwnerCredentials() })),
  hasOwner: publicProcedure.query(async () => {
    if (hasEnvironmentOwnerCredentials()) return { hasOwner: true };
    const db = await getDb();
    if (!db) return { hasOwner: false };
    const owner = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "owner"), isNotNull(users.username))).limit(1);
    return { hasOwner: Boolean(owner[0]) };
  }),
  settings: publicProcedure.query(async () => getSettings()),
  bootstrapOwner: publicProcedure.input(credentials.extend({ name: z.string().min(2).max(120), email: z.string().email().optional() })).mutation(async ({ input, ctx }) => {
    if (hasEnvironmentOwnerCredentials()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Kredensial Owner dikelola melalui Environment Variable Vercel." });
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
  updateOwnerCredentials: publicProcedure.input(sessionInput.extend({
    currentPassword: z.string().min(8).max(128),
    newUsername: z.string().trim().min(3).max(64).regex(/^[a-zA-Z0-9_.-]+$/, "Username hanya boleh huruf, angka, titik, garis bawah, atau strip.").optional(),
    newPassword: z.string().min(8).max(128).optional(),
    confirmNewPassword: z.string().min(8).max(128).optional(),
  }).superRefine((input, ctx) => {
    if (!input.newUsername && !input.newPassword) {
      ctx.addIssue({ code: "custom", message: "Isi username baru atau password baru." });
    }
    if (input.newPassword !== input.confirmNewPassword) {
      ctx.addIssue({ code: "custom", path: ["confirmNewPassword"], message: "Konfirmasi password baru tidak sama." });
    }
  })).mutation(async ({ input }) => {
    if (hasEnvironmentOwnerCredentials()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Ubah kredensial Owner melalui Environment Variable Vercel." });
    const owner = await requireOwner(input.sessionToken);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database belum tersedia." });
    if (!owner.user.passwordHash || !(await verifyPassword(input.currentPassword, owner.user.passwordHash))) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Password saat ini tidak valid." });
    }

    const nextUsername = input.newUsername && input.newUsername !== owner.user.username ? input.newUsername : undefined;
    if (nextUsername) {
      const existing = (await db.select({ id: users.id }).from(users).where(and(eq(users.username, nextUsername), ne(users.id, owner.user.id))).limit(1))[0];
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Username sudah digunakan." });
    }

    const nextPasswordHash = input.newPassword ? await hashPassword(input.newPassword) : undefined;
    const updateData: { username?: string; passwordHash?: string; openId?: string; loginMethod?: "password" | "both"; lastSignedIn: Date } = { lastSignedIn: new Date() };
    if (nextUsername) {
      updateData.username = nextUsername;
      if (owner.user.openId === `local:${owner.user.username}`) updateData.openId = `local:${nextUsername}`;
    }
    if (nextPasswordHash) {
      updateData.passwordHash = nextPasswordHash;
      updateData.loginMethod = owner.user.googleSubject ? "both" : "password";
    }

    await db.update(users).set(updateData).where(eq(users.id, owner.user.id));
    await db.update(sessions).set({ isActive: false, revokedAt: new Date() }).where(and(eq(sessions.userId, owner.user.id), ne(sessions.tokenHash, hashValue(input.sessionToken))));
    const changed = [nextUsername ? "username" : null, nextPasswordHash ? "password" : null].filter(Boolean).join(" dan ");
    await logActivity(owner.user.id, "OWNER_CREDENTIALS_UPDATED", `Memperbarui ${changed} Owner.`);
    return { success: true, username: nextUsername ?? owner.user.username };
  }),
  login: publicProcedure.input(credentials).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database belum tersedia." });
    if (hasEnvironmentOwnerCredentials() && input.username === ENV.ownerUsername) {
      if (input.password !== ENV.ownerPassword) throw new TRPCError({ code: "UNAUTHORIZED", message: "Username atau password tidak valid." });
      const owner = await ensureEnvironmentOwner(db);
      const token = await startSession(owner.id, input.deviceId, getRequestIp(ctx.req.headers));
      await logActivity(owner.id, "OWNER_LOGIN_ENVIRONMENT", "Owner masuk menggunakan kredensial Environment Variable.");
      return { sessionToken: token, user: { id: owner.id, name: owner.name ?? "Owner", role: "owner" as const, adminNumber: null } };
    }
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
