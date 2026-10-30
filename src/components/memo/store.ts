"use client";

import { useSyncExternalStore } from "react";
import { format } from "date-fns";
import type { Memo, MemoAction } from "@/lib/memoTypes";
import { memoProcessor, type MemoPlan } from "@/lib/memoProcessor";
import { addItem } from "@/lib/itemStore";
import { fmt } from "@/lib/date";
import { TODAY } from "@/mocks/today";
import { currentContent, getWikiState, submitRevision } from "@/components/wiki/store";
import { getWikiPage } from "@/mocks/wiki";

/**
 * 빠른 메모 스토어 (목업: 브라우저 저장). 실제로는 DB memos 테이블 + Claude 처리.
 * 메모를 저장하면 Claude(목업 처리기)가 읽고 → 일정·할 일·알아올 것·위키를 갱신 → 한 일을 메모에 기록.
 */

const KEY = "newb.memos.v1";

const SEED: Memo[] = [
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

let state: Memo[] | null = null;
const listeners = new Set<() => void>();

function load(): Memo[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (Array.isArray(s)) return s;
    }
  } catch {
    /* 저장소를 못 읽으면 목데이터로 */
  }
  return SEED;
}

function get(): Memo[] {
  if (typeof window === "undefined") return SEED;
  if (!state) state = load();
  return state;
}

function set(next: Memo[]) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 저장이 막혀 있으면 이번 화면에서만 */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      state = load();
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useMemos(): Memo[] {
  return useSyncExternalStore(subscribe, get, () => SEED);
}

/** 메모 저장 → 처리 시작 */
export function addMemo(text: string): string {
  const id = `m${Date.now().toString(36)}`;
  const memo: Memo = { id, text, createdAt: `${TODAY}T${format(new Date(), "HH:mm")}`, status: "processing" };
  set([memo, ...get()]);
  window.setTimeout(() => void processMemo(id), 900 + Math.random() * 500);
  return id;
}

export function deleteMemo(id: string) {
  set(get().filter((m) => m.id !== id));
}

const day = (d: string) => fmt(d, "M/d (EEE)");

/** 처리 계획을 실제 항목·위키에 반영하고, 한 일을 기록 */
function applyPlan(plan: MemoPlan): MemoAction[] {
  const actions: MemoAction[] = [];

  for (const e of plan.events) {
    const start = e.time ? `${e.date}T${e.time}` : `${e.date}T00:00`;
    const [h, m] = (e.time ?? "00:00").split(":").map(Number);
    const end = e.time ? `${e.date}T${String(Math.min(23, h + 1)).padStart(2, "0")}:${String(m).padStart(2, "0")}` : `${e.date}T23:59`;
    const id = addItem({
      title: e.title,
      kind: "event",
      start,
      end,
      allDay: !e.time,
      tags: ["meeting"],
      subItems: [],
      wikiRefs: [],
      location: e.location,
      from: e.from,
    });
    actions.push({
      kind: "create_event",
      label: `일정 추가 · ${day(e.date)}${e.time ? ` ${e.time}` : ""} ${e.title}${e.location ? ` · ${e.location}` : ""}`,
      href: `/items/${id}`,
    });
  }

  const asks = [...plan.asks];
  for (const t of plan.tasks) {
    const id = addItem({
      title: t.title,
      kind: "task",
      due: t.due,
      priority: "P2",
      status: t.waitingFor ? "waiting" : "todo",
      waitingFor: t.waitingFor,
      tags: [],
      subItems: [],
      wikiRefs: [],
      from: t.from,
    });
    actions.push({ kind: "create_task", label: `할 일 추가 · ${t.title} (마감 ${day(t.due)})`, href: `/items/${id}` });
    if (t.waitingFor) actions.push({ kind: "ask", label: `알아올 것 · ${t.waitingFor}`, href: `/items/${id}` });
  }
  // 할 일에 붙지 않은 알아올 것 → 확인용 할 일로
  for (const a of asks) {
    const id = addItem({
      title: `확인: ${a}`,
      kind: "task",
      due: TODAY,
      priority: "P2",
      status: "waiting",
      waitingFor: a,
      tags: [],
      subItems: [],
      wikiRefs: [],
      from: "메모",
    });
    actions.push({ kind: "ask", label: `알아올 것 · ${a}`, href: `/items/${id}` });
  }

  for (const w of plan.wiki) {
    const cur = currentContent(getWikiState(), w.slug);
    const heading = "## 메모에서 추가";
    const body = cur.body.includes(heading) ? `${cur.body}\n- ${w.line}` : `${cur.body}\n\n${heading}\n- ${w.line}`;
    const rev = submitRevision(w.slug, { ...cur, body }, "메모 내용 반영", "claude");
    actions.push({
      kind: "update_wiki",
      label: `위키 갱신 · ${getWikiPage(w.slug)?.title ?? w.slug}`,
      href: `/wiki/${w.slug}`,
      revisionId: rev.id,
    });
  }
  return actions;
}

async function processMemo(id: string) {
  const memo = get().find((m) => m.id === id);
  if (!memo || memo.status !== "processing") return;
  const plan = await memoProcessor.process(memo.text, TODAY);
  const actions = applyPlan(plan);
  set(get().map((m) => (m.id === id ? { ...m, status: "done", result: { cleaned: plan.cleaned, actions } } : m)));
}

/** 새로고침 등으로 처리 중에 멈춘 메모 이어서 처리 */
export function resumePending() {
  for (const m of get()) if (m.status === "processing") window.setTimeout(() => void processMemo(m.id), 600);
}
