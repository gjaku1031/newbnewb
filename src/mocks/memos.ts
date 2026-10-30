import type { Memo } from "@/lib/memoTypes";

/** 메모 목데이터 (시드용) */
export const memos: Memo[] = [
  {
    id: "m2",
    text: "법카 접대비 쓸때 참석자 직급까지 다 써야된대 선임이 2026부터 바뀐거래 재무팀에서 반려 많이한대",
    createdAt: "2026-10-29T14:52",
    status: "done",
    result: {
      cleaned: "법인카드 접대비 쓸 때 참석자 직급까지 다 써야 된대. 선임님이 2026년부터 바뀐 거래. 재무팀에서 반려 많이 한대.",
      actions: [{ kind: "update_wiki", label: "위키 갱신 · 법인카드 사용 규정 (접대비 참석자 직급 필수)", href: "/wiki/corporate-card" }],
    },
  },
  {
    id: "m1",
    text: "팀장 월욜 한빛물산 미팅 10시래 5층 대회의실에서 한다고함 회의실 예약 내가 해야됨 ㅠ 방문자 등록도??",
    createdAt: "2026-10-29T09:12",
    status: "done",
    result: {
      cleaned: "팀장님: 월요일 한빛물산 미팅 10시. 5층 대회의실에서 한다고 함. 회의실 예약은 내가 해야 됨. 방문자 등록도 해야 하는지?",
      actions: [
        { kind: "create_event", label: "일정 추가 · 11/2 (월) 10:00 한빛물산 미팅 · 5층 대회의실", href: "/items/i27" },
        { kind: "create_task", label: "할 일 추가 · 회의실 예약 (11/2 미팅)", href: "/items/i6" },
        { kind: "ask", label: "알아올 것 · 외부 손님 방문자 등록이 필요한지 확인" },
      ],
    },
  },
];
