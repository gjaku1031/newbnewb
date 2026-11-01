import type { Source } from "@/lib/types";

export const sourceTypeLabel: Record<Source["type"], string> = {
  manual: "매뉴얼",
  guideline: "가이드라인",
  boss_answer: "상사 답변",
  peer_advice: "동료 조언",
  note: "메모",
};
