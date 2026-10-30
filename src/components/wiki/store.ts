"use client";

import { useSyncExternalStore } from "react";
import { format } from "date-fns";
import type { WikiPage } from "@/lib/types";
import type { Conflict, PageContent, Revision, ReviewResult, WikiComment } from "@/lib/wikiTypes";
import { wikiPages } from "@/mocks/wiki";
import { TODAY } from "@/mocks/today";
import { wikiReviewer } from "@/lib/wikiReview";
import { wikiEditor } from "@/lib/wikiEditor";

/**
 * 위키 변경 스토어 (목업: 브라우저 저장). 실제로는 DB의 wiki_revisions 테이블.
 * - overrides: 반영된 최신 내용 (원본 목데이터 위에 덮어씀)
 * - revisions: 변경 이력 (git log)
 * - comments: 문서에 단 주석 (Claude가 모아서 반영)
 */
export interface WikiState {
  overrides: Record<string, PageContent & { updatedAt: string }>;
  revisions: Revision[];
  comments: WikiComment[];
}

const KEY = "newb.wiki.v1";
const EVENT = "newb-wiki";

const content = (p: WikiPage): PageContent => ({ title: p.title, summary: p.summary, body: p.body });
const EMPTY: PageContent = { title: "", summary: "", body: "" };

/** 목데이터 과거 이력 */
function seedRevisions(): Revision[] {
  const out: Revision[] = [];
  for (const p of wikiPages) {
    const cur = content(p);
    if (p.slug === "corporate-card") {
      const v1: PageContent = {
        ...cur,
        summary: cur.summary.replace("50만원", "30만원"),
        body: cur.body.replace("50만원", "30만원").replace(/\n## 접대비[\s\S]*?(?=\n## 증빙)/, ""),
      };
      const v2: PageContent = { ...cur, body: cur.body.replace(/\n## 접대비[\s\S]*?(?=\n## 증빙)/, "") };
      out.push(rev(p.slug, 1, "2026-10-22T09:10", "claude", "원본 문서로 생성", EMPTY, v1));
      out.push(rev(p.slug, 2, "2026-10-22T09:12", "claude", "2026 개정판 병합", v1, v2));
      out.push(rev(p.slug, 3, "2026-10-29T15:40", "me", "접대비 항목 추가", v2, cur));
    } else if (p.slug === "weekly-report") {
      const v1: PageContent = { ...cur, body: cur.body.replace(/\n\n## 자주 하는 실수[\s\S]*$/, "") };
      out.push(rev(p.slug, 1, "2026-10-24T10:05", "claude", "원본 문서로 생성", EMPTY, v1));
      out.push(rev(p.slug, 2, "2026-10-28T18:20", "me", "자주 하는 실수 추가", v1, cur));
    } else {
      out.push(rev(p.slug, 1, `${p.createdAt}T09:00`, "claude", "원본 문서로 생성", EMPTY, cur));
    }
  }
  return out;
}

function rev(
  slug: string,
  version: number,
  at: string,
  author: Revision["author"],
  message: string,
  before: PageContent,
  after: PageContent,
): Revision {
  return {
    id: `${slug}-v${version}`,
    slug,
    version,
    at,
    author,
    status: "applied",
    message,
    before,
    after,
    conflicts: [],
  };
}

const SERVER_STATE: WikiState = { overrides: {}, revisions: seedRevisions(), comments: [] };

let state: WikiState | null = null;

function load(): WikiState {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: WikiState | null = raw ? JSON.parse(raw) : null;
    state = parsed && Array.isArray(parsed.revisions) ? { ...parsed, comments: parsed.comments ?? [] } : SERVER_STATE;
  } catch {
    state = SERVER_STATE;
  }
  // 페이지 이동·새로고침으로 끊긴 검토는 다시 돌린다
  const resume = state.revisions.filter((r) => r.status === "reviewing");
  if (resume.length) window.setTimeout(() => resume.forEach(scheduleReview), 0);
  return state;
}

function save(next: WikiState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 저장이 막혀 있으면 이번 화면에서만 유지 */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      state = null;
      cb();
    }
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export const getWikiState = () => load();

export function useWiki(): WikiState {
  return useSyncExternalStore(subscribe, load, () => SERVER_STATE);
}

/* ───────── 조회 ───────── */

export function effectivePage(s: WikiState, base: WikiPage): WikiPage {
  const o = s.overrides[base.slug];
  return o ? { ...base, title: o.title, summary: o.summary, body: o.body, updatedAt: o.updatedAt } : base;
}

export function currentContent(s: WikiState, slug: string): PageContent {
  const o = s.overrides[slug];
  if (o) return { title: o.title, summary: o.summary, body: o.body };
  const base = wikiPages.find((p) => p.slug === slug);
  return base ? content(base) : EMPTY;
}

export function allContents(s: WikiState) {
  return wikiPages.map((p) => ({ slug: p.slug, ...currentContent(s, p.slug) }));
}

export const revisionsOf = (s: WikiState, slug: string) =>
  s.revisions.filter((r) => r.slug === slug).sort((a, b) => b.version - a.version);

export const commentsOf = (s: WikiState, slug: string) =>
  s.comments.filter((c) => c.slug === slug).sort((a, b) => a.at.localeCompare(b.at));

export const openComments = (s: WikiState, slug: string) => commentsOf(s, slug).filter((c) => c.status === "open");

export const pendingRevisions = (s: WikiState) =>
  s.revisions.filter((r) => r.status === "pending" || r.status === "reviewing");

/* ───────── 변경 ───────── */

const now = () => format(new Date(), "yyyy-MM-dd'T'HH:mm");

function patch(id: string, fn: (r: Revision) => Revision) {
  const s = load();
  save({ ...s, revisions: s.revisions.map((r) => (r.id === id ? fn(r) : r)) });
}

/** 변경 제출 → 검토 중 상태의 새 버전 */
export function submitRevision(
  slug: string,
  after: PageContent,
  message: string,
  author: Revision["author"] = "me",
  extra?: Pick<Revision, "commentIds" | "edits">,
): Revision {
  const s = load();
  const version = Math.max(0, ...s.revisions.filter((r) => r.slug === slug).map((r) => r.version)) + 1;
  const r: Revision = {
    id: `${slug}-v${version}-${Date.now().toString(36)}`,
    slug,
    version,
    at: now(),
    author,
    status: "reviewing",
    message: message.trim() || "내용 수정",
    before: currentContent(s, slug),
    after,
    conflicts: [],
    ...extra,
  };
  save({
    ...s,
    revisions: [...s.revisions, r],
    // 이 버전을 만든 주석은 '반영 요청됨'으로
    comments: s.comments.map((c) =>
      extra?.commentIds?.includes(c.id) ? { ...c, status: "requested", revisionId: r.id, note: undefined } : c,
    ),
  });
  scheduleReview(r);
  return r;
}

const running = new Set<string>();

/** Claude 검토 실행 (목업: 0.8~1.2초). 화면과 무관하게 스토어에서 끝까지 진행 */
function scheduleReview(r: Revision) {
  if (running.has(r.id)) return;
  running.add(r.id);
  window.setTimeout(
    async () => {
      try {
        const pages = allContents(load()).map((p) => (p.slug === r.slug ? { slug: p.slug, ...r.after } : p));
        const result = await wikiReviewer.review({ slug: r.slug, before: r.before, after: r.after }, pages);
        const cur = load().revisions.find((x) => x.id === r.id);
        if (cur?.status === "reviewing") finishReview(r.id, result);
      } finally {
        running.delete(r.id);
      }
    },
    800 + Math.random() * 400,
  );
}

/** 검토 결과 반영: 모순 없으면 바로 반영, 있으면 확인 대기 */
export function finishReview(id: string, result: ReviewResult) {
  if (result.conflicts.length === 0) applyRevision(id);
  else patch(id, (r) => ({ ...r, status: "pending", conflicts: result.conflicts as Conflict[] }));
}

export function applyRevision(id: string) {
  const s = load();
  const r = s.revisions.find((x) => x.id === id);
  if (!r) return;
  save({
    overrides: { ...s.overrides, [r.slug]: { ...r.after, updatedAt: TODAY } },
    revisions: s.revisions.map((x) => (x.id === id ? { ...x, status: "applied" } : x)),
    // 반영되면 주석은 닫힘
    comments: s.comments.map((c) => (c.revisionId === id ? { ...c, status: "applied" } : c)),
  });
}

export function cancelRevision(id: string) {
  const s = load();
  save({
    ...s,
    revisions: s.revisions.map((r) => (r.id === id ? { ...r, status: "cancelled" } : r)),
    // 취소되면 주석은 다시 열림
    comments: s.comments.map((c) => (c.revisionId === id ? { ...c, status: "open", revisionId: undefined } : c)),
  });
}

/* ───────── 주석 ───────── */

export function addComment(slug: string, anchor: WikiComment["anchor"], text: string): WikiComment {
  const s = load();
  const c: WikiComment = {
    id: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    slug,
    anchor,
    text: text.trim(),
    at: now(),
    status: "open",
  };
  save({ ...s, comments: [...s.comments, c] });
  return c;
}

export function updateComment(id: string, text: string) {
  const s = load();
  save({ ...s, comments: s.comments.map((c) => (c.id === id ? { ...c, text: text.trim(), note: undefined } : c)) });
}

export function deleteComment(id: string) {
  const s = load();
  save({ ...s, comments: s.comments.filter((c) => c.id !== id) });
}

/**
 * 열린 주석을 한 번에 Claude에게 넘김 → 고친 새 버전(작성자 Claude) → 모순 검토.
 * 바뀐 게 없으면 버전을 만들지 않고 주석에 메모만 남긴다.
 */
export async function requestClaudeEdit(slug: string): Promise<Revision | null> {
  const s = load();
  const comments = s.comments.filter((c) => c.slug === slug && c.status === "open");
  if (comments.length === 0) return null;
  const before = currentContent(s, slug);
  const { content, edits } = await wikiEditor.apply(before, comments);
  const changed = content.body !== before.body || content.title !== before.title || content.summary !== before.summary;
  const ok = edits.filter((e) => e.applied);
  if (!changed || ok.length === 0) {
    const cur = load();
    save({
      ...cur,
      comments: cur.comments.map((c) => {
        const e = edits.find((x) => x.commentId === c.id);
        return e ? { ...c, note: e.note } : c;
      }),
    });
    return null;
  }
  const r = submitRevision(slug, content, `주석 ${ok.length}개 반영`, "claude", {
    commentIds: ok.map((e) => e.commentId),
    edits,
  });
  // 반영 못 한 주석은 열린 채로 메모만
  const failed = edits.filter((e) => !e.applied);
  if (failed.length) {
    const cur = load();
    save({
      ...cur,
      comments: cur.comments.map((c) => {
        const e = failed.find((x) => x.commentId === c.id);
        return e ? { ...c, note: e.note } : c;
      }),
    });
  }
  return r;
}
