import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);

export function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [salt, savedHash] = storedHash.split(":");
  if (!salt || !savedHash) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(savedHash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export function createSessionToken() {
  return randomBytes(40).toString("base64url");
}

export function getRequestIp(headers: Record<string, string | string[] | undefined>) {
  const forwarded = headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (value?.split(",")[0] ?? "unknown").trim();
}

export function maskIpHash(value: string) {
  return value ? `${value.slice(0, 6)}••••${value.slice(-4)}` : "Tidak tersedia";
}
