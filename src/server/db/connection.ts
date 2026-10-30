import { readFileSync } from "node:fs";
import type { ConnectionOptions } from "mysql2";

/**
 * DATABASE_URL → mysql2 접속 옵션 (앱·마이그레이션·시드 공용, Next 없이도 쓰는 순수 모듈)
 *
 * DATABASE_URL          mysql://user:password@host:3306/newb[?ssl=true]
 * DATABASE_SSL_CA_FILE  (선택) 서버 인증서를 검증할 CA(PEM) 경로 — 있으면 TLS + CA 검증
 * DATABASE_SSL          (선택) required | verify_ca | off — 생략하면
 *                       CA 파일이 있으면 verify_ca, 주소에 ssl=true면 required, 아니면 off
 *
 * required = 암호화만 (mysql --ssl-mode=REQUIRED와 같음, 사설 VCN 안에서 ken-prod 기본)
 * verify_ca = 암호화 + CA 검증 (ken-prod의 BYOC 인증서는 사설 CA라 CA 파일이 필요)
 * 주소의 ssl=true를 mysql2에 그대로 넘기면 "SSL profile must be an object" 오류가 나므로 여기서 해석한다.
 */
export type SslMode = "off" | "required" | "verify_ca";

export function mysqlOptions(env: Record<string, string | undefined> = process.env): ConnectionOptions {
  const raw = env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL이 설정되지 않았습니다");
  const url = new URL(raw);
  if (url.protocol !== "mysql:") throw new Error("DATABASE_URL은 mysql://로 시작해야 합니다");

  const urlSsl = url.searchParams.get("ssl") ?? url.searchParams.get("ssl-mode") ?? url.searchParams.get("sslmode");
  const caFile = env.DATABASE_SSL_CA_FILE;
  const mode = sslMode(env.DATABASE_SSL, caFile, urlSsl);

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    ssl: sslOptions(mode, caFile),
  };
}

function sslMode(explicit: string | undefined, caFile: string | undefined, urlSsl: string | null): SslMode {
  const v = explicit?.trim().toLowerCase();
  if (v === "off" || v === "required" || v === "verify_ca") return v;
  if (v) throw new Error(`DATABASE_SSL 값을 알 수 없어요: ${explicit} (off | required | verify_ca)`);
  if (caFile) return "verify_ca";
  if (urlSsl && !/^(false|0|off|disabled)$/i.test(urlSsl)) return "required";
  return "off";
}

function sslOptions(mode: SslMode, caFile: string | undefined): ConnectionOptions["ssl"] {
  if (mode === "off") return undefined;
  if (mode === "required") return { rejectUnauthorized: false };
  if (!caFile) throw new Error("DATABASE_SSL=verify_ca에는 DATABASE_SSL_CA_FILE이 필요합니다");
  // IP로 접속하면 mysql2는 호스트 이름 검사를 하지 않고 CA 체인만 검증한다
  return { ca: readFileSync(caFile, "utf8"), rejectUnauthorized: true };
}
