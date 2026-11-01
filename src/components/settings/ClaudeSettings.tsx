import { Plug } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { SettingsSection } from "./Section";

const MCP_URL = "https://newb.maekr.cloud/api/mcp";

const TOOLS = [
  { name: "ask_newb", desc: "질문 근거 찾기·기록" },
  { name: "get_task_brief", desc: "할 일 작업 지침" },
  { name: "get_guidelines", desc: "가이드라인 검색" },
  { name: "add_to_wiki", desc: "위키에 추가" },
];

const STEPS = [
  "Claude Desktop → 설정 → 커넥터 → '커스텀 커넥터 추가'",
  "아래 MCP 서버 URL을 붙여넣고 이름을 newb로 저장",
  "브라우저에서 Passkey로 로그인해 연결 승인",
];

export function ClaudeSettings() {
  return (
    <SettingsSection
      id="claude"
      title="Claude Desktop 연결"
      icon={<Plug className="size-4" />}
    >
      <div className="space-y-3 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[14px] font-medium">MCP 서버 URL</div>
          {/* TODO(MCP): 실제 연결 상태·마지막 호출 시각 */}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sunken px-2.5 py-0.5 text-[12px] font-semibold text-muted">
            <span className="size-1.5 rounded-full bg-faint" />
            준비 중
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2">
          <code className="min-w-0 flex-1 truncate text-[13.5px]">{MCP_URL}</code>
          <CopyButton text={MCP_URL} />
        </div>
      </div>

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
