import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { canAccessOwnerControl } from "../../shared/access";
import { getAuthorizedSession } from "../db";

export const sessionInput = z.object({ sessionToken: z.string().min(40) });

export async function requireSession(sessionToken: string) {
  const authorized = await getAuthorizedSession(sessionToken);
  if (!authorized) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sesi tidak lagi aktif. Silakan masuk kembali." });
  return authorized;
}

export async function requireOwner(sessionToken: string) {
  const authorized = await requireSession(sessionToken);
  if (!canAccessOwnerControl(authorized.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Akses ini khusus Owner." });
  return authorized;
}
