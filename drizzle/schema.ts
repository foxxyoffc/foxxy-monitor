import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 128 }).notNull().unique(),
    username: varchar("username", { length: 64 }),
    passwordHash: varchar("passwordHash", { length: 255 }),
    name: varchar("name", { length: 120 }),
    email: varchar("email", { length: 320 }),
    googleSubject: varchar("googleSubject", { length: 255 }).unique(),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: mysqlEnum("role", ["user", "owner", "admin"]).default("user").notNull(),
    status: mysqlEnum("status", ["active", "blacklisted", "deleted"]).default("active").notNull(),
    adminNumber: int("adminNumber"),
    lastDeviceHash: varchar("lastDeviceHash", { length: 128 }),
    lastIpHash: varchar("lastIpHash", { length: 128 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    uniqueIndex("users_username_unique").on(table.username),
    index("users_role_status_idx").on(table.role, table.status),
  ],
);

export const sessions = mysqlTable(
  "sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
    deviceHash: varchar("deviceHash", { length: 128 }).notNull(),
    ipHash: varchar("ipHash", { length: 128 }).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
    revokedAt: timestamp("revokedAt"),
  },
  (table) => [index("sessions_user_active_idx").on(table.userId, table.isActive)],
);

export const blockedDevices = mysqlTable(
  "blockedDevices",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    deviceHash: varchar("deviceHash", { length: 128 }).notNull(),
    ipHash: varchar("ipHash", { length: 128 }).notNull(),
    blockedByUserId: int("blockedByUserId").notNull(),
    reason: varchar("reason", { length: 255 }).default("Diblokir oleh owner").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("blocked_device_unique").on(table.userId, table.deviceHash, table.ipHash),
    index("blocked_user_idx").on(table.userId),
  ],
);

export const activityLogs = mysqlTable(
  "activityLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    actorUserId: int("actorUserId").notNull(),
    targetUserId: int("targetUserId"),
    action: varchar("action", { length: 120 }).notNull(),
    detail: text("detail"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("activity_created_idx").on(table.createdAt)],
);

export const appSettings = mysqlTable("appSettings", {
  id: int("id").primaryKey(),
  siteTitle: varchar("siteTitle", { length: 80 }).default("Foxxy Monitor").notNull(),
  logoUrl: text("logoUrl"),
  ownerSociabuzzUrl: text("ownerSociabuzzUrl"),
  updatedByUserId: int("updatedByUserId"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const dailyMetrics = mysqlTable(
  "dailyMetrics",
  {
    id: int("id").autoincrement().primaryKey(),
    metricDate: varchar("metricDate", { length: 10 }).notNull(),
    appKey: mysqlEnum("appKey", ["apk1", "apk2", "apk3"]).notNull(),
    premiumPayments: int("premiumPayments").default(0).notNull(),
    pending: int("pending").default(0).notNull(),
    success: int("success").default(0).notNull(),
    canceled: int("canceled").default(0).notNull(),
    failed: int("failed").default(0).notNull(),
    revenue: int("revenue").default(0).notNull(),
    adsRevenue: int("adsRevenue").default(0).notNull(),
    updatedByUserId: int("updatedByUserId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("daily_metrics_unique").on(table.metricDate, table.appKey)],
);

export const financialRecords = mysqlTable(
  "financialRecords",
  {
    id: int("id").autoincrement().primaryKey(),
    type: mysqlEnum("type", ["maintenance", "savings"]).notNull(),
    amount: int("amount").notNull(),
    note: varchar("note", { length: 255 }),
    recordedAt: timestamp("recordedAt").defaultNow().notNull(),
    createdByUserId: int("createdByUserId").notNull(),
  },
  (table) => [index("financial_type_date_idx").on(table.type, table.recordedAt)],
);

export const savingsPlans = mysqlTable(
  "savingsPlans",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    durationMonths: mysqlEnum("durationMonths", ["1", "3", "12"]).notNull(),
    targetAmount: int("targetAmount").notNull(),
    startDate: varchar("startDate", { length: 10 }).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdByUserId: int("createdByUserId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("savings_plan_active_idx").on(table.isActive, table.startDate)],
);

export const savingsEntries = mysqlTable(
  "savingsEntries",
  {
    id: int("id").autoincrement().primaryKey(),
    planId: int("planId").notNull(),
    type: mysqlEnum("type", ["deposit", "withdrawal"]).notNull(),
    amount: int("amount").notNull(),
    note: varchar("note", { length: 255 }),
    recordedAt: timestamp("recordedAt").defaultNow().notNull(),
    createdByUserId: int("createdByUserId").notNull(),
  },
  (table) => [index("savings_entry_plan_date_idx").on(table.planId, table.recordedAt)],
);

export const announcements = mysqlTable(
  "announcements",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 150 }).notNull(),
    content: text("content").notNull(),
    isPinned: boolean("isPinned").default(false).notNull(),
    createdByUserId: int("createdByUserId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("announcement_created_idx").on(table.createdAt)],
);

export const chatMessages = mysqlTable(
  "chatMessages",
  {
    id: int("id").autoincrement().primaryKey(),
    senderUserId: int("senderUserId").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    deletedAt: timestamp("deletedAt"),
  },
  (table) => [index("chat_created_idx").on(table.createdAt)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
