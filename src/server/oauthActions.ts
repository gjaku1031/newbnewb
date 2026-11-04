"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/server/db/client";
import { requireUser } from "@/server/auth";
import { checkAuthorize, createCode, oauthConfig, redirectWith, revokeConnection } from "@/server/services/oauth";

/**
 * 연결 승인 화면의 [허용]/[거부]. 요청 값은 숨은 칸(q)으로 다시 받아 처음부터 다시 확인한다.
 * 로그인(Passkey)한 사람만 허용할 수 있다.
 */
export async function decideAuthorize(formData: FormData) {
  await requireUser();
  const q = Object.fromEntries(new URLSearchParams(String(formData.get("q") ?? ""))) as Record<string, string | undefined>;
  const allow = formData.get("decision") === "allow";
  const db = getDb();
  const cfg = oauthConfig();
  const checked = await checkAuthorize(db, cfg, q);
  if ("fatal" in checked) throw new Error(checked.fatal);
  if ("redirectError" in checked) {
    const e = checked.redirectError;
    redirect(redirectWith(e.redirectUri, { error: e.error, error_description: e.description, state: e.state, iss: cfg.issuer }));
  }
  const r = checked.ok;
  if (!allow) redirect(redirectWith(r.redirectUri, { error: "access_denied", state: r.state, iss: cfg.issuer }));
  const code = await createCode(db, r);
  redirect(redirectWith(r.redirectUri, { code, state: r.state, iss: cfg.issuer }));
}

/** 설정 → Claude Desktop 연결 끊기 */
export async function disconnectClaude(grantId: string) {
  await requireUser();
  if (!/^[0-9a-f]{32}$/.test(grantId)) return;
  await revokeConnection(getDb(), grantId);
}
