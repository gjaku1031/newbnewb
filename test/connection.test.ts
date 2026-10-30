import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mysqlOptions } from "@/server/db/connection";

describe("DATABASE_URL 해석", () => {
  it("setup-mysql.sh가 만드는 주소(?ssl=true) → 암호화만 (mysql2에 ssl=true를 그대로 넘기지 않음)", () => {
    const o = mysqlOptions({ DATABASE_URL: "mysql://newb:a-B_9x@10.0.0.47:3306/newb?ssl=true" });
    expect(o).toMatchObject({ host: "10.0.0.47", port: 3306, user: "newb", password: "a-B_9x", database: "newb" });
    expect(o.ssl).toEqual({ rejectUnauthorized: false });
  });

  it("CA 파일이 있으면 CA로 검증", () => {
    const dir = mkdtempSync(join(tmpdir(), "newb-ca-"));
    const ca = join(dir, "ca.pem");
    writeFileSync(ca, "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----\n");
    const o = mysqlOptions({ DATABASE_URL: "mysql://u:p@db:3306/newb?ssl=true", DATABASE_SSL_CA_FILE: ca });
    expect(o.ssl).toMatchObject({ rejectUnauthorized: true });
    expect((o.ssl as { ca: string }).ca).toContain("TEST");
  });

  it("로컬(ssl 없음) → 평문, 비밀번호의 특수문자는 디코딩", () => {
    const o = mysqlOptions({ DATABASE_URL: "mysql://newb:p%40ss%2Fw@127.0.0.1:23306/newb" });
    expect(o.ssl).toBeUndefined();
    expect(o.password).toBe("p@ss/w");
  });

  it("잘못된 설정은 바로 알려준다", () => {
    expect(() => mysqlOptions({})).toThrow("DATABASE_URL");
    expect(() => mysqlOptions({ DATABASE_URL: "postgres://x@y/z" })).toThrow("mysql://");
    expect(() => mysqlOptions({ DATABASE_URL: "mysql://u:p@h/d", DATABASE_SSL: "verify_ca" })).toThrow("CA_FILE");
    expect(() => mysqlOptions({ DATABASE_URL: "mysql://u:p@h/d", DATABASE_SSL: "yes" })).toThrow("DATABASE_SSL");
  });
});
