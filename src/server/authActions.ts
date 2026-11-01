"use server";

/**
 * Passkey 로그인 서버 액션.
 * 서버 액션은 Next가 요청 출처(Origin)를 확인하므로 다른 사이트에서 대신 부를 수 없다.
 * 실패 이유는 throw 대신 값으로 돌려준다 (운영 빌드는 throw한 메시지를 화면에 넘기지 않음).
 */
import { cookies, headers } from "next/headers";
import { z } from "zod";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { getCurrentUser, sessionCookie } from "@/lib/auth";
import { getDb } from "@/server/db/client";
import { requireUser } from "@/server/auth";
import * as auth from "@/server/services/auth";

export type AuthResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

const ChallengeId = z.string().regex(/^[0-9a-f]{32}$/);
const Invite = z.string().regex(/^[A-Za-z0-9_-]{20,100}$/).optional();
const PasskeyId = z.string().min(1).max(255);
/** 브라우저가 만든 응답 — 형식만 가볍게 보고 나머지는 SimpleWebAuthn이 검증 */
const Credential = z.looseObject({
  id: z.string().min(1).max(1400),
  rawId: z.string().min(1).max(1400),
  type: z.literal("public-key"),
  response: z.looseObject({ clientDataJSON: z.string().max(10_000) }),
  clientExtensionResults: z.looseObject({}),
});

async function run<T>(task: () => Promise<T>): Promise<AuthResult<T>> {
  try {
    return { ok: true, data: await task() };
  } catch (error) {
    if (error instanceof auth.AuthError) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) return { ok: false, error: "요청 형식이 올바르지 않아요." };
    console.error("[auth] 처리 실패", error);
    return { ok: false, error: "처리하지 못했어요. 잠시 뒤 다시 시도해 주세요." };
  }
}

async function startSession(passkeyId: string) {
  const token = await auth.createSession(getDb(), passkeyId);
  const { name, secure } = sessionCookie();
  (await cookies()).set(name, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: auth.SESSION_DAYS * 24 * 60 * 60,
  });
}

/* ───────── 등록 (초대 링크로 처음, 또는 로그인한 상태에서 기기 추가) ───────── */

export async function beginRegistration(invite?: string): Promise<AuthResult<auth.Started<PublicKeyCredentialCreationOptionsJSON>>> {
  return run(async () => {
    const signedIn = !!(await getCurrentUser());
    return auth.startRegistration(getDb(), auth.relyingParty(), { signedIn, invite: Invite.parse(invite) });
  });
}

export async function completeRegistration(input: {
  challengeId: string;
  response: RegistrationResponseJSON;
  invite?: string;
}): Promise<AuthResult> {
  return run(async () => {
    const signedIn = !!(await getCurrentUser());
    const invite = Invite.parse(input.invite);
    const passkeyId = await auth.finishRegistration(getDb(), auth.relyingParty(), {
      challengeId: ChallengeId.parse(input.challengeId),
      response: Credential.parse(input.response) as unknown as RegistrationResponseJSON,
      signedIn,
      invite,
      deviceName: auth.deviceName((await headers()).get("user-agent")),
    });
    // 초대로 등록했으면 바로 로그인
    if (!signedIn) await startSession(passkeyId);
    return null;
  });
}

/* ───────── 로그인·로그아웃 ───────── */

export async function beginLogin(): Promise<AuthResult<auth.Started<PublicKeyCredentialRequestOptionsJSON>>> {
  return run(() => auth.startLogin(getDb(), auth.relyingParty()));
}

export async function completeLogin(input: { challengeId: string; response: AuthenticationResponseJSON }): Promise<AuthResult> {
  return run(async () => {
    const passkeyId = await auth.finishLogin(getDb(), auth.relyingParty(), {
      challengeId: ChallengeId.parse(input.challengeId),
      response: Credential.parse(input.response) as unknown as AuthenticationResponseJSON,
    });
    await startSession(passkeyId);
    return null;
  });
}

export async function logout(): Promise<AuthResult> {
  return run(async () => {
    const jar = await cookies();
    const { name } = sessionCookie();
    await auth.deleteSession(getDb(), jar.get(name)?.value);
    jar.delete(name);
    return null;
  });
}

/* ───────── Passkey 관리 ───────── */

export async function removePasskey(id: string): Promise<AuthResult> {
  return run(async () => {
    const user = await requireUser().catch(() => {
      throw new auth.AuthError("로그인이 필요해요.");
    });
    await auth.deletePasskey(getDb(), PasskeyId.parse(id), user.passkeyId);
    return null;
  });
}
