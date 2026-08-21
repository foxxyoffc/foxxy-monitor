import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import {
  activityLogs,
  announcements,
  appSettings,
  blockedDevices,
  chatMessages,
  dailyMetrics,
  financialRecords,
  InsertUser,
  savingsEntries,
  savingsPlans,
  sessions,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: mysql.Pool | null = null;

export function shouldUseTls(databaseUrl: string) {
  try {
    const host = new URL(databaseUrl).hostname.toLowerCase();
    return process.env.TIDB_ENABLE_SSL === "true" || host.endsWith("tidbcloud.com");
  } catch {
    return process.env.TIDB_ENABLE_SSL === "true";
  }
}

export function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.TIDB_HOST;
  const user = process.env.TIDB_USER;
  const password = process.env.TIDB_PASSWORD;
  if (!host || !user || !password) return undefined;
  const port = process.env.TIDB_PORT || "4000";
  const database = process.env.TIDB_DATABASE || "sys";
  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
}

function createPool(databaseUrl: string) {
  const connectionUrl = new URL(databaseUrl);
  const database = decodeURIComponent(connectionUrl.pathname.replace(/^\//, ""));
  return mysql.createPool({
    host: connectionUrl.hostname,
    port: Number(connectionUrl.port || 3306),
    user: decodeURIComponent(connectionUrl.username),
    password: decodeURIComponent(connectionUrl.password),
    database,
    ssl: shouldUseTls(databaseUrl) ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
    connectionLimit: process.env.NODE_ENV === "production" ? 1 : 5,
    maxIdle: 1,
    enableKeepAlive: true,
  });
}

export async function getDb() {
  const databaseUrl = resolveDatabaseUrl();
  if (!_db && databaseUrl) {
    _pool = createPool(databaseUrl);
    _db = drizzle({ client: _pool });
  }
  return _db;
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function upsertUser(user: InsertUser): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const role = user.role ?? (user.openId === ENV.ownerOpenId ? "owner" : "user");
  await db.insert(users).values({
    ...user,
    name: user.name ?? null,
    role,
    lastSignedIn: user.lastSignedIn ?? new Date(),
  }).onDuplicateKeyUpdate({
    set: { name: user.name ?? null, email: user.email ?? null, lastSignedIn: new Date() },
  });
}

export async function getSettings() {
  const db = await getDb();
  if (!db) return { id: 1, siteTitle: "Foxxy Monitor", logoUrl: null, ownerSociabuzzUrl: null };
  const existing = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(appSettings).values({ id: 1, siteTitle: "Foxxy Monitor" }).onDuplicateKeyUpdate({ set: { siteTitle: "Foxxy Monitor" } });
  const created = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  return created[0] ?? { id: 1, siteTitle: "Foxxy Monitor", logoUrl: null, ownerSociabuzzUrl: null };
}

export async function logActivity(actorUserId: number, action: string, detail?: string, targetUserId?: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLogs).values({ actorUserId, targetUserId, action, detail });
}

export async function getAuthorizedSession(sessionToken: string) {
  const db = await getDb();
  if (!db) return undefined;
  const tokenHash = (await import("./security")).hashValue(sessionToken);
  const result = await db.select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), eq(sessions.isActive, true), eq(users.status, "active")))
    .limit(1);
  if (!result[0]) return undefined;
  await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, result[0].session.id));
  return result[0];
}

export async function dashboardSummary() {
  const db = await getDb();
  if (!db) return { metrics: [], financial: [], announcements: [], savingsPlans: [], savingsEntries: [] };
  const [metrics, financial, announcementRows, activeSavingsPlans, recentSavingsEntries] = await Promise.all([
    db.select().from(dailyMetrics).orderBy(desc(dailyMetrics.metricDate)).limit(120),
    db.select().from(financialRecords).orderBy(desc(financialRecords.recordedAt)).limit(100),
    db.select().from(announcements).orderBy(desc(announcements.isPinned), desc(announcements.createdAt)).limit(10),
    db.select().from(savingsPlans).where(eq(savingsPlans.isActive, true)).orderBy(desc(savingsPlans.createdAt)).limit(12),
    db.select().from(savingsEntries).orderBy(desc(savingsEntries.recordedAt)).limit(100),
  ]);
  return { metrics, financial, announcements: announcementRows, savingsPlans: activeSavingsPlans, savingsEntries: recentSavingsEntries };
}

export async function latestMessages(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ message: chatMessages, user: users })
    .from(chatMessages)
    .innerJoin(users, eq(chatMessages.senderUserId, users.id))
    .where(sql`${chatMessages.deletedAt} is null`)
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
}

export const tables = { users, sessions, blockedDevices, activityLogs, announcements, appSettings, dailyMetrics, financialRecords, savingsPlans, savingsEntries, chatMessages };
