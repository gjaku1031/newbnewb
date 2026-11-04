import { connection } from "next/server";
import { Plug } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { getCurrentUser } from "@/lib/auth";
import { utcToKst } from "@/lib/kst";
import { getDb } from "@/server/db/client";
import { listConnections } from "@/server/services/oauth";
import { DisconnectButton } from "./DisconnectButton";
import { SettingsSection } from "./Section";

const TOOLS = [
  { name: "ask_newb", desc: "질문에 위키·원본 근거로 답하고 질문 기록에 남김" },
  { name: "get_task_brief", desc: "할 일 작업 지침·관련 위키·주의할 점" },
  { name: "get_guidelines", desc: "위키·원본 문서 찾기" },
  { name: "add_to_wiki", desc: "알게 된 내용을 위키에 추가" },
];

const STEPS = [
  "Claude Desktop → 설정 → 커넥터 → '커스텀 커넥터 추가'",
  "이름은 newb, URL에 아래 MCP 서버 URL을 붙여넣고 추가",
  "'연결'을 누르면 열리는 newb 화면에서 Passkey로 로그인 후 '허용'",
];

/** Claude Desktop(MCP) 연결: 주소·추가 방법·도구, 연결된 클라이언트와 마지막 호출, 연결 끊기 */
export async function ClaudeSettings() {
  await connection();
  const user = await getCurrentUser();
  const origin = (process.env.APP_ORIGIN ?? "https://newb.maekr.cloud").replace(/\/+$/, "");
  const mcpUrl = `${origin}/api/mcp`;
  const connections = user ? await listConnections(getDb()) : [];
  const last = utcToKst(connections.map((c) => c.lastUsedAt).filter(Boolean).sort().pop());

  return (
    <SettingsSection id="claude" title="Claude Desktop 연결" icon={<Plug className="size-4" />}>
      <div className="space-y-3 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[14px] font-medium">MCP 서버 URL</div>
          {connections.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-2.5 py-0.5 text-[12px] font-semibold text-ok">
              <span className="size-1.5 rounded-full bg-ok" />
              연결됨{last ? ` · 마지막 호출 ${last.slice(5)}` : " · 아직 호출 없음"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sunken px-2.5 py-0.5 text-[12px] font-semibold text-muted">
              <span className="size-1.5 rounded-full bg-faint" />
              연결 전
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2">
          <code className="min-w-0 flex-1 truncate text-[13.5px]">{mcpUrl}</code>
          <CopyButton text={mcpUrl} />
        </div>
      </div>

      {connections.length > 0 && (
        <ul className="divide-y divide-line">
          {connections.map((c) => (
            <li key={c.grantId} className="flex items-center gap-3 px-6 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium">{c.clientName}</div>
                <div className="text-[12.5px] text-muted tabular">
                  연결 {utcToKst(c.connectedAt)?.slice(0, 10)} · {c.lastUsedAt ? `마지막 호출 ${utcToKst(c.lastUsedAt)}` : "아직 호출 없음"}
                </div>
              </div>
              <DisconnectButton grantId={c.grantId} name={c.clientName} />
            </li>
          ))}
        </ul>
      )}

      <div className="px-6 py-4">
        <div className="text-[14px] font-medium">커넥터 추가 방법</div>
        <ol className="mt-3 grid gap-2 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={i} className="rounded-lg border border-line bg-bg px-3.5 py-3 text-[13px] leading-relaxed">
              <span className="mb-1 block text-[12px] font-semibold text-accent">STEP {i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>

      <div className="px-6 py-4">
        <div className="text-[14px] font-medium">제공하는 도구</div>
        <ul className="mt-2 divide-y divide-line">
          {TOOLS.map((t) => (
            <li key={t.name} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5">
              <code className="w-[130px] shrink-0 text-[13px] font-semibold text-accent-ink">{t.name}</code>
              <span className="min-w-0 flex-1 text-[13px] text-muted">{t.desc}</span>
            </li>
          ))}
        </ul>
      </div>
    </SettingsSection>
  );
}
