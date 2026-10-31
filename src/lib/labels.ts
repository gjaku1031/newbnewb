import type { QuestionRecord, Source } from "@/lib/types";

export const sourceTypeLabel: Record<Source["type"], string> = {
  manual: "매뉴얼",
  guideline: "가이드라인",
  boss_answer: "상사 답변",
  peer_advice: "동료 조언",
  note: "메모",
};

export const signalLabel: Record<keyof QuestionRecord["signals"], string> = {
  coverage: "근거 커버리지",
  conflict: "근거 충돌",
  freshness: "근거 신선도",
  risk: "행동 위험도",
  ambiguity: "질문 모호성",
};
