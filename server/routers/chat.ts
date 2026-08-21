import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { chatMessages } from "../../drizzle/schema";
import { getDb, latestMessages, logActivity } from "../db";
import { publicProcedure, router } from "../_core/trpc";
import { requireOwner, requireSession, sessionInput } from "./guards";

export const chatRouter = router({
  list: publicProcedure.input(sessionInput).query(async ({ input }) => {
    await requireSession(input.sessionToken);
    return latestMessages();
  }),
  send: publicProcedure.input(sessionInput.extend({ content: z.string().trim().min(1).max(1500) })).mutation(async ({ input }) => {
    const authorized = await requireSession(input.sessionToken);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database belum tersedia." });
    await db.insert(chatMessages).values({ senderUserId: authorized.user.id, content: input.content });
    return { success: true };
  }),
  deleteHistory: publicProcedure.input(sessionInput).mutation(async ({ input }) => {
    const owner = await requireOwner(input.sessionToken);
    const db = await getDb();
    if (db) await db.update(chatMessages).set({ deletedAt: new Date() }).where(sql`${chatMessages.deletedAt} is null`);
    await logActivity(owner.user.id, "CHAT_HISTORY_DELETED", "Menghapus riwayat chat room.");
    return { success: true };
  }),
});
