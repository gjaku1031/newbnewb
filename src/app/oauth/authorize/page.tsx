import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Plug } from "lucide-react";
import { Card, PageBody, PageHeader } from "@/components/ui";
import { getDb } from "@/server/db/client";
import {
  checkAuthorize,
  oauthConfig,
  redirectWith,
} from "@/server/services/oauth";
import { decideAuthorize } from "@/server/oauthActions";

export const metadata: Metadata = { title: "Claude 연결 승인 · newb" };

const TOOLS = [
  "newb 위키·원본·주의할 점으로 질문에 답하고 질문 기록에 남기기",
  "할 일의 작업 지침과 관련 위키 읽기",
  "위키·원본 문서 찾기",
  "새로 알게 된 내용을 위키에 추가하기",
];

/**
 * Claude Desktop 커스텀 커넥터의 OAuth 승인 화면.
 * 로그인하지 않았으면 레이아웃이 Passkey 로그인 화면을 먼저 보여주고, 로그인하면 이 화면으로 돌아온다.
 */
export default function AuthorizePage({
  searchParams,
}: PageProps<"/oauth/authorize">) {
  return (
    <>
      <PageHeader title="Claude 연결 승인" />
      <PageBody>
        {/* 요청마다 DB를 읽는 부분은 Suspense 안에서 */}
        <Suspense fallback={null}>
          <Consent searchParams={searchParams} />
        </Suspense>
      </PageBody>
    </>
  );
}

async function Consent({
  searchParams,
}: {
  searchParams: PageProps<"/oauth/authorize">["searchParams"];
}) {
  await connection();
  const raw = await searchParams;
  const q = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  ) as Record<string, string | undefined>;
  const cfg = oauthConfig();
  const checked = await checkAuthorize(getDb(), cfg, q);
  if ("redirectError" in checked) {
    const e = checked.redirectError;
    redirect(
      redirectWith(e.redirectUri, {
        error: e.error,
        error_description: e.description,
        state: e.state,
        iss: cfg.issuer,
      }),
    );
  }

  return (
    <>
      <Card className="mx-auto max-w-[520px] p-6">
        {"fatal" in checked ? (
          <p role="alert" className="text-[14px] text-danger">
            {checked.fatal} Claude 설정에서 커넥터를 다시 추가해 주세요.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[15px] font-semibold">
              <Plug className="size-4 text-accent" />
              {checked.ok.clientName}이(가) newb에 연결하려고 해요
            </div>
            <p className="mt-2 text-[13.5px] text-muted">
              허용하면 Claude Desktop에서 다음을 할 수 있어요.
            </p>
            <ul className="mt-3 space-y-1.5 text-[13.5px]">
              {TOOLS.map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12.5px] text-faint">
              연결은 설정 → Claude Desktop 연결에서 언제든 끊을 수 있어요.
            </p>
            <form
              action={decideAuthorize}
              className="mt-5 flex justify-end gap-2"
            >
              <input
                type="hidden"
                name="q"
                value={new URLSearchParams(
                  q as Record<string, string>,
                ).toString()}
              />
              <button
                name="decision"
                value="deny"
                className="h-9 rounded-lg border border-line px-3.5 text-[14px] font-medium hover:bg-sunken"
              >
                거부
              </button>
              <button
                name="decision"
                value="allow"
                className="h-9 rounded-lg bg-accent px-3.5 text-[14px] font-medium text-white hover:bg-accent-ink"
              >
                허용
              </button>
            </form>
          </>
        )}
      </Card>
    </>
  );
}
