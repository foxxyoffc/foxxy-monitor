import { z } from "zod";

export const monthlyResetConfirmation = z.literal("RESET BULANAN");
export const allResetConfirmation = z.literal("RESET SEMUA");

export function canRestoreAdmin(status: "active" | "blacklisted" | "deleted") {
  return status === "blacklisted";
}

export function calculateSavingsBalance(entries: Array<{ type: "deposit" | "withdrawal"; amount: number }>) {
  return entries.reduce((total, entry) => total + (entry.type === "deposit" ? entry.amount : -entry.amount), 0);
}

export function calculateSavingsProgress(balance: number, targetAmount: number) {
  if (targetAmount <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((balance / targetAmount) * 100)));
}
