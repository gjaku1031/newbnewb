"use client";

import { WebAuthnError, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { beginLogin, beginRegistration, completeLogin, completeRegistration } from "@/server/authActions";

/** 브라우저 쪽 실패를 사람이 읽을 말로 */
function browserError(error: unknown) {
  if (error instanceof WebAuthnError) {
    if (error.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") return "이 기기에는 이미 Passkey가 있어요.";
    if (error.code === "ERROR_CEREMONY_ABORTED") return "취소했어요.";
  }
  if (error instanceof Error && error.name === "NotAllowedError") return "취소했거나 시간이 지났어요. 다시 눌러 주세요.";
  if (error instanceof Error && error.name === "SecurityError") return "이 주소에서는 Passkey를 쓸 수 없어요 (https 주소로 열어 주세요).";
  console.error(error);
  return "Passkey를 쓰지 못했어요. 다시 시도해 주세요.";
}

/** 성공하면 null, 실패하면 안내 문구 */
export async function registerPasskey(invite?: string): Promise<string | null> {
  const begun = await beginRegistration(invite);
  if (!begun.ok) return begun.error;
  let response;
  try {
    response = await startRegistration({ optionsJSON: begun.data.options });
  } catch (error) {
    return browserError(error);
  }
  const done = await completeRegistration({ challengeId: begun.data.challengeId, response, invite });
  return done.ok ? null : done.error;
}

export async function loginWithPasskey(): Promise<string | null> {
  const begun = await beginLogin();
  if (!begun.ok) return begun.error;
  let response;
  try {
    response = await startAuthentication({ optionsJSON: begun.data.options });
  } catch (error) {
    return browserError(error);
  }
  const done = await completeLogin({ challengeId: begun.data.challengeId, response });
  return done.ok ? null : done.error;
}
