import { afterEach, describe, expect, it } from "vitest";
import { resolveDatabaseUrl, shouldUseTls } from "./db";

describe("database TLS selection", () => {
  const original = process.env.TIDB_ENABLE_SSL;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalTidbHost = process.env.TIDB_HOST;
  const originalTidbUser = process.env.TIDB_USER;
  const originalTidbPassword = process.env.TIDB_PASSWORD;
  const originalTidbPort = process.env.TIDB_PORT;
  const originalTidbDatabase = process.env.TIDB_DATABASE;

  afterEach(() => {
    if (original === undefined) delete process.env.TIDB_ENABLE_SSL;
    else process.env.TIDB_ENABLE_SSL = original;
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = originalDatabaseUrl;
    if (originalTidbHost === undefined) delete process.env.TIDB_HOST; else process.env.TIDB_HOST = originalTidbHost;
    if (originalTidbUser === undefined) delete process.env.TIDB_USER; else process.env.TIDB_USER = originalTidbUser;
    if (originalTidbPassword === undefined) delete process.env.TIDB_PASSWORD; else process.env.TIDB_PASSWORD = originalTidbPassword;
    if (originalTidbPort === undefined) delete process.env.TIDB_PORT; else process.env.TIDB_PORT = originalTidbPort;
    if (originalTidbDatabase === undefined) delete process.env.TIDB_DATABASE; else process.env.TIDB_DATABASE = originalTidbDatabase;
  });

  it("mengaktifkan TLS otomatis untuk host TiDB Cloud", () => {
    delete process.env.TIDB_ENABLE_SSL;
    expect(shouldUseTls("mysql://user:pass@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/sys")).toBe(true);
  });

  it("mengizinkan TLS dipaksa pada host MySQL lain melalui environment", () => {
    process.env.TIDB_ENABLE_SSL = "true";
    expect(shouldUseTls("mysql://user:pass@db.example.com:3306/app")).toBe(true);
  });

  it("membuat URL database aman dari parameter TiDB terpisah", () => {
    delete process.env.DATABASE_URL;
    process.env.TIDB_HOST = "gateway01.ap-southeast-1.prod.aws.tidbcloud.com";
    process.env.TIDB_USER = "prefix.root";
    process.env.TIDB_PASSWORD = "rahasia@aman";
    process.env.TIDB_PORT = "4000";
    process.env.TIDB_DATABASE = "sys";
    expect(resolveDatabaseUrl()).toBe("mysql://prefix.root:rahasia%40aman@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/sys");
  });
});
