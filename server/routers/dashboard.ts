import { and, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { allResetConfirmation, monthlyResetConfirmation } from "../../shared/ownerControls";
import { z } from "zod";
import { announcements, appSettings, dailyMetrics, financialRecords, savingsEntries, savingsPlans } from "../../drizzle/schema";
import { dashboardSummary, getDb, getSettings, logActivity } from "../db";
import { publicProcedure, router } from "../_core/trpc";
import { requireOwner, requireSession, sessionInput } from "./guards";

const appKey = z.enum(["apk1", "apk2", "apk3"]);

export const dashboardRouter = router({
  summary: publicProcedure.input(sessionInput).query(async ({ input }) => {
    await requireSession(input.sessionToken);
    return dashboardSummary();
  }),
  saveMetric: publicProcedure.input(sessionInput.extend({ metricDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), appKey, premiumPayments: z.number().int().min(0), pending: z.number().int().min(0), success: z.number().int().min(0), canceled: z.number().int().min(0), failed: z.number().int().min(0), revenue: z.number().int().min(0), adsRevenue: z.number().int().min(0) })).mutation(async ({ input }) => {
    const authorized = await requireSession(input.sessionToken);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database belum tersedia." });
    const values = { metricDate: input.metricDate, appKey: input.appKey, premiumPayments: input.premiumPayments, pending: input.pending, success: input.success, canceled: input.canceled, failed: input.failed, revenue: input.revenue, adsRevenue: input.adsRevenue, updatedByUserId: authorized.user.id };
    await db.insert(dailyMetrics).values(values).onDuplicateKeyUpdate({ set: values });
    await logActivity(authorized.user.id, "METRIC_UPDATED", `Memperbarui metrik ${input.appKey} pada ${input.metricDate}.`);
    return { success: true };
  }),
  saveFinancialRecord: publicProcedure.input(sessionInput.extend({ type: z.enum(["maintenance", "savings"]), amount: z.number().int().min(0), note: z.string().max(255).optional() })).mutation(async ({ input }) => {
    const authorized = await requireSession(input.sessionToken);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database belum tersedia." });
    await db.insert(financialRecords).values({ type: input.type, amount: input.amount, note: input.note, createdByUserId: authorized.user.id });
    return { success: true };
  }),
  resetMonthlyMetrics: publicProcedure.input(sessionInput.extend({ month: z.string().regex(/^\d{4}-\d{2}$/), confirmation: monthlyResetConfirmation })).mutation(async ({ input }) => {
    const owner = await requireOwner(input.sessionToken);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database belum tersedia." });
    await db.delete(dailyMetrics).where(sql`${dailyMetrics.metricDate} like ${`${input.month}%`}`);
    await logActivity(owner.user.id, "MONTHLY_METRICS_RESET", `Mereset transaksi untuk ${input.month}.`);
    return { success: true };
  }),
  resetAllMetrics: publicProcedure.input(sessionInput.extend({ confirmation: allResetConfirmation })).mutation(async ({ input }) => {
    const owner = await requireOwner(input.sessionToken);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database belum tersedia." });
    await db.delete(dailyMetrics);
    await logActivity(owner.user.id, "ALL_METRICS_RESET", "Mereset seluruh data transaksi aplikasi.");
    return { success: true };
  }),
  listSavings: publicProcedure.input(sessionInput).query(async ({ input }) => {
    await requireSession(input.sessionToken);
    const db = await getDb();
    if (!db) return { plans: [], entries: [] };
    const [plans, entries] = await Promise.all([db.select().from(savingsPlans).where(eq(savingsPlans.isActive, true)).orderBy(desc(savingsPlans.createdAt)), db.select().from(savingsEntries).orderBy(desc(savingsEntries.recordedAt)).limit(200)]);
    return { plans, entries };
  }),
  createSavingsPlan: publicProcedure.input(sessionInput.extend({ name: z.string().min(3).max(120), durationMonths: z.enum(["1", "3", "12"]), targetAmount: z.number().int().positive(), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).mutation(async ({ input }) => {
    const owner = await requireOwner(input.sessionToken);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database belum tersedia." });
    const saved = await db.insert(savingsPlans).values({ name: input.name, durationMonths: input.durationMonths, targetAmount: input.targetAmount, startDate: input.startDate, createdByUserId: owner.user.id });
    await logActivity(owner.user.id, "SAVINGS_PLAN_CREATED", `Membuat tabungan ${input.durationMonths} bulan: ${input.name}.`);
    return { planId: Number(saved[0].insertId) };
  }),
  addSavingsEntry: publicProcedure.input(sessionInput.extend({ planId: z.number().int().positive(), type: z.enum(["deposit", "withdrawal"]), amount: z.number().int().positive(), note: z.string().max(255).optional() })).mutation(async ({ input }) => {
    const owner = await requireOwner(input.sessionToken);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database belum tersedia." });
    const plan = (await db.select({ id: savingsPlans.id }).from(savingsPlans).where(and(eq(savingsPlans.id, input.planId), eq(savingsPlans.isActive, true))).limit(1))[0];
    if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Rencana tabungan aktif tidak ditemukan." });
    await db.insert(savingsEntries).values({ planId: input.planId, type: input.type, amount: input.amount, note: input.note, createdByUserId: owner.user.id });
    await logActivity(owner.user.id, input.type === "deposit" ? "SAVINGS_DEPOSIT" : "SAVINGS_WITHDRAWAL", `${input.type === "deposit" ? "Setoran" : "Pengeluaran"} tabungan #${input.planId}.`);
    return { success: true };
  }),
  deleteSavingsHistory: publicProcedure.input(sessionInput.extend({ planId: z.number().int().positive().optional() })).mutation(async ({ input }) => {
    const owner = await requireOwner(input.sessionToken);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database belum tersedia." });
    if (input.planId) await db.delete(savingsEntries).where(eq(savingsEntries.planId, input.planId)); else await db.delete(savingsEntries);
    await logActivity(owner.user.id, "SAVINGS_HISTORY_DELETED", input.planId ? `Menghapus riwayat mutasi tabungan #${input.planId}.` : "Menghapus seluruh riwayat mutasi tabungan.");
    return { success: true };
  }),
  deleteSavingsPlan: publicProcedure.input(sessionInput.extend({ planId: z.number().int().positive() })).mutation(async ({ input }) => {
    const owner = await requireOwner(input.sessionToken);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database belum tersedia." });
    await db.delete(savingsEntries).where(eq(savingsEntries.planId, input.planId));
    await db.delete(savingsPlans).where(eq(savingsPlans.id, input.planId));
    await logActivity(owner.user.id, "SAVINGS_PLAN_DELETED", `Menghapus target tabungan #${input.planId} beserta riwayatnya.`);
    return { success: true };
  }),
  updateOwnerLinks: publicProcedure.input(sessionInput.extend({ ownerSociabuzzUrl: z.string().url().nullable() })).mutation(async ({ input }) => {
    const owner = await requireOwner(input.sessionToken);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database belum tersedia." });
    await db.insert(appSettings).values({ id: 1, ownerSociabuzzUrl: input.ownerSociabuzzUrl, updatedByUserId: owner.user.id }).onDuplicateKeyUpdate({ set: { ownerSociabuzzUrl: input.ownerSociabuzzUrl, updatedByUserId: owner.user.id } });
    await logActivity(owner.user.id, "OWNER_LINK_UPDATED", "Memperbarui tautan Kopi untuk Owner.");
    return getSettings();
  }),
  searchMusic: publicProcedure.input(sessionInput.extend({ query: z.string().trim().min(2).max(120) })).query(async ({ input }) => {
    await requireSession(input.sessionToken);
    const params = new URLSearchParams({ term: input.query, country: "ID", media: "music", entity: "song", explicit: "No", limit: "12" });
    const response = await fetch(`https://itunes.apple.com/search?${params.toString()}`);
    if (!response.ok) throw new TRPCError({ code: "BAD_GATEWAY", message: "Layanan pencarian musik sedang tidak tersedia." });
    const payload = await response.json() as { results?: Array<{ trackId?: number; trackName?: string; artistName?: string; collectionName?: string; artworkUrl100?: string; previewUrl?: string }> };
    return (payload.results ?? []).filter((track) => track.previewUrl && track.trackName).map((track) => ({ id: track.trackId ?? `${track.trackName}-${track.artistName}`, title: track.trackName ?? "Tanpa judul", artist: track.artistName ?? "Artis tidak diketahui", album: track.collectionName ?? "", artworkUrl: track.artworkUrl100 ?? "", previewUrl: track.previewUrl! }));
  }),
  updateBrand: publicProcedure.input(sessionInput.extend({ siteTitle: z.string().min(3).max(80), logoUrl: z.string().url().nullable() })).mutation(async ({ input }) => {
    const owner = await requireOwner(input.sessionToken);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database belum tersedia." });
    await db.insert(appSettings).values({ id: 1, siteTitle: input.siteTitle, logoUrl: input.logoUrl, updatedByUserId: owner.user.id }).onDuplicateKeyUpdate({ set: { siteTitle: input.siteTitle, logoUrl: input.logoUrl, updatedByUserId: owner.user.id } });
    await logActivity(owner.user.id, "BRAND_UPDATED", "Memperbarui judul atau logo Foxxy Monitor.");
    return getSettings();
  }),
  listAnnouncements: publicProcedure.input(sessionInput).query(async ({ input }) => {
    await requireSession(input.sessionToken);
    const db = await getDb();
    return db ? db.select().from(announcements).orderBy(desc(announcements.isPinned), desc(announcements.createdAt)).limit(20) : [];
  }),
  createAnnouncement: publicProcedure.input(sessionInput.extend({ title: z.string().min(3).max(150), content: z.string().min(3).max(4000), isPinned: z.boolean().default(false) })).mutation(async ({ input }) => {
    const owner = await requireOwner(input.sessionToken);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database belum tersedia." });
    await db.insert(announcements).values({ title: input.title, content: input.content, isPinned: input.isPinned, createdByUserId: owner.user.id });
    await logActivity(owner.user.id, "ANNOUNCEMENT_CREATED", input.title);
    return { success: true };
  }),
  deleteAnnouncement: publicProcedure.input(sessionInput.extend({ announcementId: z.number().int().positive() })).mutation(async ({ input }) => {
    const owner = await requireOwner(input.sessionToken);
    const db = await getDb();
    if (db) await db.delete(announcements).where(eq(announcements.id, input.announcementId));
    await logActivity(owner.user.id, "ANNOUNCEMENT_DELETED", `Menghapus pengumuman #${input.announcementId}.`);
    return { success: true };
  }),
});
