import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuthorizedSession = vi.fn();

vi.mock("../db", () => ({ getAuthorizedSession }));

const { requireOwner, requireSession } = await import("./guards");

describe("session guards", () => {
  beforeEach(() => getAuthorizedSession.mockReset());

  it("menolak token sesi yang sudah dicabut atau tidak lagi valid", async () => {
    getAuthorizedSession.mockResolvedValue(undefined);
    await expect(requireSession("revoked-session-token")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("menerima sesi aktif dan mengizinkan kontrol hanya untuk Owner", async () => {
    const ownerSession = { user: { id: 1, role: "owner" as const } };
    getAuthorizedSession.mockResolvedValue(ownerSession);
    await expect(requireSession("active-owner-session")).resolves.toEqual(ownerSession);
    await expect(requireOwner("active-owner-session")).resolves.toEqual(ownerSession);

    getAuthorizedSession.mockResolvedValue({ user: { id: 2, role: "admin" as const } });
    await expect(requireOwner("active-admin-session")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
