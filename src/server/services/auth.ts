import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, count, desc, eq, gt, isNull, lte, sql } from "drizzle-orm";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { authChallenges, authInvites, authSessions, passkeys } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { affectedRows } from "./jobs";

/**
 * Passkey 로그인 (1인용).
 * - 첫 Passkey는 서버에서 만든 1회용 초대(CLI)로만 등록한다 — 공개 주소라 아무나 먼저 등록하지 못하게
 * - 그 뒤 기기 추가는 로그인한 상태에서
 * - 세션은 쿠키에 무작위 값, DB에는 그 SHA-256만 저장
 */

export class AuthError extends Error {}

/** WebAuthn 신뢰 당사자: APP_ORIGIN(예: https://newb.maekr.cloud)에서 정한다 */
export interface RelyingParty {
  id: string;
  origin: string;
  name: string;
}

export function relyingParty(appOrigin = process.env.APP_ORIGIN): RelyingParty {
  if (!appOrigin) throw new AuthError("서버에 APP_ORIGIN이 설정되지 않았어요");
  const url = new URL(appOrigin);
  return { id: url.hostname, origin: url.origin, name: "newb" };
}

export const SESSION_DAYS = 30;
const CHALLENGE_MINUTES = 5;
/** 살아 있는 도전값이 이보다 많으면 새로 만들지 않는다 (공개 주소에서 DB를 채우는 요청 막기) */
const MAX_LIVE_CHALLENGES = 100;
/** 1인용 앱의 주인 — 모든 Passkey가 같은 사용자 핸들을 쓴다 (같은 기기에 다시 만들면 덮어씀) */
const OWNER_HANDLE = new TextEncoder().encode("newb-owner");

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");
const now = sql`CURRENT_TIMESTAMP(3)`;
const inMinutes = (m: number) => sql`CURRENT_TIMESTAMP(3) + INTERVAL ${sql.raw(String(Math.trunc(m)))} MINUTE`;

/* ───────── 초대 ───────── */

/** 1회용 초대 토큰 (원래 값은 돌려주기만 하고 DB엔 해시) */
export async function createInvite(db: Db, minutes = 30) {
  const token = newToken();
  await db.insert(authInvites).values({ tokenHash: sha256(token), expiresAt: inMinutes(minutes) });
  return token;
}

async function inviteUsable(db: Db, token: string | undefined) {
  if (!token) return false;
  const [row] = await db
    .select({ tokenHash: authInvites.tokenHash })
    .from(authInvites)
    .where(and(eq(authInvites.tokenHash, sha256(token)), isNull(authInvites.usedAt), gt(authInvites.expiresAt, now)));
  return !!row;
}

const INVITE_INVALID = "초대 링크가 없거나 이미 쓰였거나 만료됐어요. 서버에서 새 링크를 만들어 주세요.";

/* ───────── 도전값 ───────── */

async function saveChallenge(db: Db, purpose: "register" | "login", challenge: string) {
  await db.delete(authChallenges).where(lte(authChallenges.expiresAt, now));
  const [{ live }] = await db.select({ live: count() }).from(authChallenges);
  if (live >= MAX_LIVE_CHALLENGES) throw new AuthError("요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.");
  const id = randomBytes(16).toString("hex");
  await db
    .insert(authChallenges)
    .values({ id, challenge, purpose, expiresAt: inMinutes(CHALLENGE_MINUTES) });
  return id;
}

/** 도전값을 꺼내면서 지운다 — 같은 응답을 두 번 쓸 수 없게 (지운 쪽만 성공) */
async function takeChallenge(db: Db, id: string, purpose: "register" | "login") {
  const [row] = await db
    .select({ challenge: authChallenges.challenge })
    .from(authChallenges)
    .where(and(eq(authChallenges.id, id), eq(authChallenges.purpose, purpose), gt(authChallenges.expiresAt, now)));
  if (!row) return null;
  const res = await db.delete(authChallenges).where(eq(authChallenges.id, id));
  return affectedRows(res) === 1 ? row.challenge : null;
}

const CHALLENGE_GONE = "시간이 지났어요. 처음부터 다시 시도해 주세요.";

/* ───────── 등록 ───────── */

export interface Started<T> {
  challengeId: string;
  options: T;
}

/** 로그인하지 않았으면 초대 토큰이 있어야 한다 */
export async function startRegistration(
  db: Db,
  rp: RelyingParty,
  { signedIn, invite }: { signedIn: boolean; invite?: string },
): Promise<Started<PublicKeyCredentialCreationOptionsJSON>> {
  if (!signedIn && !(await inviteUsable(db, invite))) throw new AuthError(INVITE_INVALID);
  const existing = await db.select({ id: passkeys.id, transports: passkeys.transports }).from(passkeys);
  const options = await generateRegistrationOptions({
    rpName: rp.name,
    rpID: rp.id,
    userName: "newb",
    userDisplayName: "newb",
    userID: OWNER_HANDLE,
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({ id: p.id, transports: p.transports ?? undefined })),
    // 아이디 없이 로그인하려면 기기에 저장되는 Passkey여야 하고, 유일한 로그인 수단이라 본인 확인(생체·PIN)을 요구
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  return { challengeId: await saveChallenge(db, "register", options.challenge), options };
}

/** 등록 확인 → Passkey 저장 (초대로 등록했으면 초대를 쓴 것으로). 새 Passkey id를 돌려준다 */
export async function finishRegistration(
  db: Db,
  rp: RelyingParty,
  input: { challengeId: string; response: RegistrationResponseJSON; signedIn: boolean; invite?: string; deviceName: string },
) {
  if (!input.signedIn && !(await inviteUsable(db, input.invite))) throw new AuthError(INVITE_INVALID);
  const challenge = await takeChallenge(db, input.challengeId, "register");
  if (!challenge) throw new AuthError(CHALLENGE_GONE);

  const result = await verifyRegistrationResponse({
    response: input.response,
    expectedChallenge: challenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.id,
    requireUserVerification: true,
  }).catch((error: unknown) => {
    console.warn("[auth] 등록 확인 실패", error instanceof Error ? error.message : error);
    return null;
  });
  if (!result?.verified) throw new AuthError("Passkey를 확인하지 못했어요. 다시 시도해 주세요.");

  const { credential, credentialDeviceType, credentialBackedUp } = result.registrationInfo;
  if (credential.id.length > 255) throw new AuthError("이 Passkey는 쓸 수 없어요 (ID가 너무 길어요).");

  await db.transaction(async (tx) => {
    if (!input.signedIn) {
      const used = await tx
        .update(authInvites)
        .set({ usedAt: now })
        .where(
          and(eq(authInvites.tokenHash, sha256(input.invite!)), isNull(authInvites.usedAt), gt(authInvites.expiresAt, now)),
        );
      if (affectedRows(used) !== 1) throw new AuthError(INVITE_INVALID);
    }
    await tx.insert(passkeys).values({
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports ?? null,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      name: input.deviceName.slice(0, 100),
      lastUsedAt: now,
    });
  });
  return credential.id;
}

/* ───────── 로그인 ───────── */

export async function startLogin(db: Db, rp: RelyingParty): Promise<Started<PublicKeyCredentialRequestOptionsJSON>> {
  // allowCredentials를 비워 두면 기기가 이 사이트의 Passkey를 골라 준다 (아이디 입력 없음)
  const options = await generateAuthenticationOptions({ rpID: rp.id, userVerification: "required" });
  return { challengeId: await saveChallenge(db, "login", options.challenge), options };
}

/** 로그인 확인 → 사용한 Passkey id */
export async function finishLogin(
  db: Db,
  rp: RelyingParty,
  input: { challengeId: string; response: AuthenticationResponseJSON },
) {
  const challenge = await takeChallenge(db, input.challengeId, "login");
  if (!challenge) throw new AuthError(CHALLENGE_GONE);

  const [pk] = await db.select().from(passkeys).where(eq(passkeys.id, input.response.id));
  if (!pk) throw new AuthError("등록되지 않은 Passkey예요. 다른 Passkey를 고르거나 설정에서 이 기기를 추가해 주세요.");

  const result = await verifyAuthenticationResponse({
    response: input.response,
    expectedChallenge: challenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.id,
    credential: {
      id: pk.id,
      publicKey: new Uint8Array(Buffer.from(pk.publicKey, "base64url")),
      counter: pk.counter,
      transports: pk.transports ?? undefined,
    },
    requireUserVerification: true,
  }).catch((error: unknown) => {
    console.warn("[auth] 로그인 확인 실패", error instanceof Error ? error.message : error);
    return null;
  });
  if (!result?.verified) throw new AuthError("Passkey를 확인하지 못했어요. 다시 시도해 주세요.");

  await db
    .update(passkeys)
    .set({
      counter: result.authenticationInfo.newCounter,
      backedUp: result.authenticationInfo.credentialBackedUp,
      lastUsedAt: now,
    })
    .where(eq(passkeys.id, pk.id));
  return pk.id;
}

/* ───────── 세션 ───────── */

export async function createSession(db: Db, passkeyId: string) {
  const token = newToken();
  await db.delete(authSessions).where(lte(authSessions.expiresAt, now));
  await db.insert(authSessions).values({
    idHash: sha256(token),
    passkeyId,
    expiresAt: sql`CURRENT_TIMESTAMP(3) + INTERVAL ${sql.raw(String(SESSION_DAYS))} DAY`,
  });
  return token;
}

/** 유효한 세션이면 그 세션을 연 Passkey id */
export async function sessionPasskey(db: Db, token: string | undefined) {
  if (!token || token.length > 128) return null;
  const [row] = await db
    .select({ passkeyId: authSessions.passkeyId })
    .from(authSessions)
    .where(and(eq(authSessions.idHash, sha256(token)), gt(authSessions.expiresAt, now)));
  return row?.passkeyId ?? null;
}

export async function deleteSession(db: Db, token: string | undefined) {
  if (!token) return;
  await db.delete(authSessions).where(eq(authSessions.idHash, sha256(token)));
}

/* ───────── Passkey 관리 ───────── */

export interface PasskeyInfo {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  backedUp: boolean;
}

export async function listPasskeys(db: Db): Promise<PasskeyInfo[]> {
  return db
    .select({
      id: passkeys.id,
      name: passkeys.name,
      createdAt: passkeys.createdAt,
      lastUsedAt: passkeys.lastUsedAt,
      backedUp: passkeys.backedUp,
    })
    .from(passkeys)
    .orderBy(desc(passkeys.createdAt));
}

export async function passkeyCount(db: Db) {
  const [{ n }] = await db.select({ n: count() }).from(passkeys);
  return n;
}

/** 지금 로그인에 쓴 Passkey와 마지막 하나는 지울 수 없다 (잠기지 않게). 그 Passkey로 연 세션도 함께 끝난다 */
export async function deletePasskey(db: Db, id: string, currentPasskeyId: string | null) {
  if (id === currentPasskeyId) throw new AuthError("지금 이 로그인에 쓴 Passkey는 지울 수 없어요.");
  if ((await passkeyCount(db)) <= 1) throw new AuthError("마지막 Passkey는 지울 수 없어요.");
  await db.delete(passkeys).where(eq(passkeys.id, id));
}

/** User-Agent로 기기 이름 추정 (Passkey 목록에서 구분하는 용도) */
export function deviceName(userAgent: string | null | undefined) {
  const ua = userAgent ?? "";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh|Mac OS X/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  if (/CrOS/.test(ua)) return "Chromebook";
  if (/Linux/.test(ua)) return "Linux";
  return "기기";
}
