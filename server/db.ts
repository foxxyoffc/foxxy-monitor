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
let _schemaReady: Promise<void> | null = null;

const schemaStatements = [
  "CREATE TABLE IF NOT EXISTS `users` (`id` int AUTO_INCREMENT NOT NULL, `openId` varchar(128) NOT NULL, `username` varchar(64), `passwordHash` varchar(255), `name` varchar(120), `email` varchar(320), `googleSubject` varchar(255), `loginMethod` varchar(64), `role` enum('user','owner','admin') NOT NULL DEFAULT 'user', `status` enum('active','blacklisted','deleted') NOT NULL DEFAULT 'active', `adminNumber` int, `lastDeviceHash` varchar(128), `lastIpHash` varchar(128), `createdAt` timestamp NOT NULL DEFAULT (now()), `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, `lastSignedIn` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `users_id` PRIMARY KEY(`id`), CONSTRAINT `users_openId_unique` UNIQUE(`openId`), CONSTRAINT `users_googleSubject_unique` UNIQUE(`googleSubject`), CONSTRAINT `users_email_unique` UNIQUE(`email`), CONSTRAINT `users_username_unique` UNIQUE(`username`), INDEX `users_role_status_idx` (`role`,`status`))",
  "CREATE TABLE IF NOT EXISTS `sessions` (`id` int AUTO_INCREMENT NOT NULL, `userId` int NOT NULL, `tokenHash` varchar(128) NOT NULL, `deviceHash` varchar(128) NOT NULL, `ipHash` varchar(128) NOT NULL, `isActive` boolean NOT NULL DEFAULT true, `createdAt` timestamp NOT NULL DEFAULT (now()), `lastSeenAt` timestamp NOT NULL DEFAULT (now()), `revokedAt` timestamp, CONSTRAINT `sessions_id` PRIMARY KEY(`id`), CONSTRAINT `sessions_tokenHash_unique` UNIQUE(`tokenHash`), INDEX `sessions_user_active_idx` (`userId`,`isActive`))",
  "CREATE TABLE IF NOT EXISTS `blockedDevices` (`id` int AUTO_INCREMENT NOT NULL, `userId` int NOT NULL, `deviceHash` varchar(128) NOT NULL, `ipHash` varchar(128) NOT NULL, `blockedByUserId` int NOT NULL, `reason` varchar(255) NOT NULL DEFAULT 'Diblokir oleh owner', `createdAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `blockedDevices_id` PRIMARY KEY(`id`), CONSTRAINT `blocked_device_unique` UNIQUE(`userId`,`deviceHash`,`ipHash`), INDEX `blocked_user_idx` (`userId`))",
  "CREATE TABLE IF NOT EXISTS `activityLogs` (`id` int AUTO_INCREMENT NOT NULL, `actorUserId` int NOT NULL, `targetUserId` int, `action` varchar(120) NOT NULL, `detail` text, `createdAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `activityLogs_id` PRIMARY KEY(`id`), INDEX `activity_created_idx` (`createdAt`))",
  "CREATE TABLE IF NOT EXISTS `appSettings` (`id` int NOT NULL, `siteTitle` varchar(80) NOT NULL DEFAULT 'Foxxy Monitor', `logoUrl` text, `ownerSociabuzzUrl` text, `updatedByUserId` int, `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT `appSettings_id` PRIMARY KEY(`id`))",
  "CREATE TABLE IF NOT EXISTS `dailyMetrics` (`id` int AUTO_INCREMENT NOT NULL, `metricDate` varchar(10) NOT NULL, `appKey` enum('apk1','apk2','apk3') NOT NULL, `premiumPayments` int NOT NULL DEFAULT 0, `pending` int NOT NULL DEFAULT 0, `success` int NOT NULL DEFAULT 0, `canceled` int NOT NULL DEFAULT 0, `failed` int NOT NULL DEFAULT 0, `revenue` int NOT NULL DEFAULT 0, `adsRevenue` int NOT NULL DEFAULT 0, `updatedByUserId` int NOT NULL, `createdAt` timestamp NOT NULL DEFAULT (now()), `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT `dailyMetrics_id` PRIMARY KEY(`id`), CONSTRAINT `daily_metrics_unique` UNIQUE(`metricDate`,`appKey`))",
  "CREATE TABLE IF NOT EXISTS `financialRecords` (`id` int AUTO_INCREMENT NOT NULL, `type` enum('maintenance','savings') NOT NULL, `amount` int NOT NULL, `note` varchar(255), `recordedAt` timestamp NOT NULL DEFAULT (now()), `createdByUserId` int NOT NULL, CONSTRAINT `financialRecords_id` PRIMARY KEY(`id`), INDEX `financial_type_date_idx` (`type`,`recordedAt`))",
  "CREATE TABLE IF NOT EXISTS `savingsPlans` (`id` int AUTO_INCREMENT NOT NULL, `name` varchar(120) NOT NULL, `durationMonths` enum('1','3','12') NOT NULL, `targetAmount` int NOT NULL, `startDate` varchar(10) NOT NULL, `isActive` boolean NOT NULL DEFAULT true, `createdByUserId` int NOT NULL, `createdAt` timestamp NOT NULL DEFAULT (now()), `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT `savingsPlans_id` PRIMARY KEY(`id`), INDEX `savings_plan_active_idx` (`isActive`,`startDate`))",
  "CREATE TABLE IF NOT EXISTS `savingsEntries` (`id` int AUTO_INCREMENT NOT NULL, `planId` int NOT NULL, `type` enum('deposit','withdrawal') NOT NULL, `amount` int NOT NULL, `note` varchar(255), `recordedAt` timestamp NOT NULL DEFAULT (now()), `createdByUserId` int NOT NULL, CONSTRAINT `savingsEntries_id` PRIMARY KEY(`id`), INDEX `savings_entry_plan_date_idx` (`planId`,`recordedAt`))",
  "CREATE TABLE IF NOT EXISTS `announcements` (`id` int AUTO_INCREMENT NOT NULL, `title` varchar(150) NOT NULL, `content` text NOT NULL, `isPinned` boolean NOT NULL DEFAULT false, `createdByUserId` int NOT NULL, `createdAt` timestamp NOT NULL DEFAULT (now()), `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT `announcements_id` PRIMARY KEY(`id`), INDEX `announcement_created_idx` (`createdAt`))",
  "CREATE TABLE IF NOT EXISTS `chatMessages` (`id` int AUTO_INCREMENT NOT NULL, `senderUserId` int NOT NULL, `content` text NOT NULL, `createdAt` timestamp NOT NULL DEFAULT (now()), `deletedAt` timestamp, CONSTRAINT `chatMessages_id` PRIMARY KEY(`id`), INDEX `chat_created_idx` (`createdAt`))",
];

export async function bootstrapSchema(pool: mysql.Pool) {
  const connection = await pool.promise().getConnection();
  try {
    for (const statement of schemaStatements) await connection.query(statement);
  } finally {
    connection.release();
  }
}

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
  const database = process.env.TIDB_DATABASE || "test";
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
    _schemaReady = bootstrapSchema(_pool);
  }
  if (_schemaReady) await _schemaReady;
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
