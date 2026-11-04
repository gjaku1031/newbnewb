import { connection } from "next/server";
import { Sparkles } from "lucide-react";
import { CLAUDE_MODEL, claudeEnabled } from "@/server/ai/claude";
import { Row, SettingsSection } from "./Section";

/** 메모 정리·위키 편집·모순 검토를 무엇이 처리하는지 (서버 설정을 보여주기만 함) */
export async function AiSettings() {
  // API 키는 실행 중인 서버 기준으로 읽는다 (빌드 때 값이 박히지 않게)
  await connection();
  const enabled = claudeEnabled();
  const model = CLAUDE_MODEL;
  return (
    <SettingsSection
      id="ai"
      title="Claude API"
      description="메모 정리, 위키 주석 반영, 위키 모순 검토를 Claude가 처리해요."
      icon={<Sparkles className="size-4" />}
    >
      <Row label="상태">
        {enabled ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-2.5 py-0.5 text-[12px] font-semibold text-ok">
            <span className="size-1.5 rounded-full bg-ok" />
            사용 중 · {model}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/10 px-2.5 py-0.5 text-[12px] font-semibold text-danger">
            <span className="size-1.5 rounded-full bg-danger" />
            API 키 없음 · 메모 정리·위키 반영·검토가 동작하지 않아요
          </span>
        )}
      </Row>
    </SettingsSection>
  );
}
