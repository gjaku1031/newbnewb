import type { RescheduleProposal } from "@/lib/types";

export const rescheduleProposal: RescheduleProposal = {
  id: "r1",
  createdAt: "2026-10-30T08:00",
  summary:
    "이번 주에 P0~P1 작업이 3개 몰려 있어요. 월요일 미팅 자료(P0)에 금요일 오전을 통째로 쓰고, 법인카드 정리는 선임님 답변을 기다리는 중이라 토요일→월요일 오후로 미루는 걸 제안해요.",
  items: [
    {
      itemId: "i3",
      fromDate: "2026-10-31",
      toDate: "2026-11-02",
      fromPriority: "P1",
      toPriority: "P1",
      reason: "선임님 답변 대기 중이라 지금 해도 마무리가 안 돼요. 마감(11/3) 전날로.",
    },
    {
      itemId: "i4",
      fromDate: "2026-11-03",
      toDate: "2026-11-04",
      fromPriority: "P2",
      toPriority: "P2",
      reason: "11/3은 법인카드 마감일이라 하루 뒤로. 마감(11/5)까지 여유 있어요.",
    },
    {
      itemId: "i5",
      fromDate: "2026-11-04",
      toDate: "2026-11-05",
      fromPriority: "P2",
      toPriority: "P3",
      reason: "교육 마감이 11/7이라 급하지 않아요. 우선순위를 한 단계 낮춰요.",
    },
    {
      itemId: "i9",
      toDate: "2026-11-06",
      fromPriority: "P5",
      toPriority: "P5",
      reason: "일정이 없던 작업이라 여유 있는 금요일 오후에 배치해요.",
    },
  ],
};
