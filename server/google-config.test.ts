import { describe, expect, it } from "vitest";

describe("Google OAuth configuration", () => {
  it("memiliki Client ID Google Web Application yang valid untuk Google Identity", () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    expect(clientId, "GOOGLE_CLIENT_ID harus diisi").toMatch(/^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/);
  });
});
