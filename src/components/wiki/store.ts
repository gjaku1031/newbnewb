"use client";

import type { WikiPage } from "@/lib/types";
import type { PageContent, Revision, WikiComment } from "@/lib/wikiTypes";
import type { WikiData, WorkspaceSnapshot } from "@/lib/workspace";
import { NOW } from "@/lib/today";
import { getWorkspace, mutate, newClientId, refresh, useWorkspace } from "@/components/workspace/store";
import * as actions from "@/server/actions";

/**
 * 위키 스토어 — 작업공간 스토어 위의 얇은 층.
 * 페이지·원본·변경 이력·주석은 서버(DB)에 있고, 검토(모순 찾기)는 서버가 돌린다.
 */
export type WikiState = WikiData;

export const getWikiState = (): WikiState => getWorkspace().wiki;

export function useWiki(): WikiState {
  return useWorkspace((s) => s.wiki);
}

const EMPTY: PageContent = { title: "", summary: "", body: "" };

/* ───────── 조회 ───────── */

export const findPage = (s: WikiState, slug: string) => s.pages.find((p) => p.slug === slug);

/** 지금 반영된 페이지 (스토어에 없으면 넘겨받은 값) */
export function effectivePage(s: WikiState, base: WikiPage): WikiPage {
  return findPage(s, base.slug) ?? base;
}

export function currentContent(s: WikiState, slug: string): PageContent {
  const p = findPage(s, slug);
  return p ? { title: p.title, summary: p.summary, body: p.body } : EMPTY;
}

export const revisionsOf = (s: WikiState, slug: string) =>
  s.revisions.filter((r) => r.slug === slug).sort((a, b) => b.version - a.version);

export const commentsOf = (s: WikiState, slug: string) =>
  s.comments.filter((c) => c.slug === slug).sort((a, b) => a.at.localeCompare(b.at));

export const openComments = (s: WikiState, slug: string) => commentsOf(s, slug).filter((c) => c.status === "open");

export const pendingRevisions = (s: WikiState) =>
  s.revisions.filter((r) => r.status === "pending" || r.status === "reviewing");

/* ───────── 변경 ───────── */

const withWiki = (fn: (w: WikiState) => WikiState) => (s: WorkspaceSnapshot) => ({ ...s, wiki: fn(s.wiki) });

/** 변경 제출 → 검토 중 상태의 새 버전 (검토 결과는 서버에서 끝나면 다시 불러와 반영) */
export function submitRevision(slug: string, after: PageContent, message: string): Revision {
  const s = getWikiState();
  const version = Math.max(0, ...s.revisions.filter((r) => r.slug === slug).map((r) => r.version)) + 1;
  const r: Revision = {
    id: `${slug}-v${version}-${Date.now().toString(36)}`,
    slug,
    version,
    at: NOW,
    author: "me",
    status: "reviewing",
    message: message.trim() || "내용 수정",
    before: currentContent(s, slug),
    after,
    conflicts: [],
  };
  void mutate(
    withWiki((w) => ({ ...w, revisions: [...w.revisions, r] })),
    () => actions.submitRevision({ id: r.id, slug, after, message }),
  );
  return r;
}

export function applyRevision(id: string) {
  void mutate(
    withWiki((w) => {
      const r = w.revisions.find((x) => x.id === id);
      if (!r) return w;
      return {
        ...w,
        pages: w.pages.map((p) => (p.slug === r.slug ? { ...p, ...r.after, updatedAt: NOW.slice(0, 10) } : p)),
        revisions: w.revisions.map((x) => (x.id === id ? { ...x, status: "applied" } : x)),
        // 반영되면 주석은 닫힘
        comments: w.comments.map((c) => (c.revisionId === id ? { ...c, status: "applied" } : c)),
      };
    }),
    () => actions.applyRevision(id),
  );
}

export function cancelRevision(id: string) {
  void mutate(
    withWiki((w) => ({
      ...w,
      revisions: w.revisions.map((r) => (r.id === id ? { ...r, status: "cancelled" } : r)),
      // 취소되면 주석은 다시 열림
      comments: w.comments.map((c) => (c.revisionId === id ? { ...c, status: "open", revisionId: undefined } : c)),
    })),
    () => actions.cancelRevision(id),
  );
}

/* ───────── 주석 ───────── */

export function addComment(slug: string, anchor: WikiComment["anchor"], text: string): WikiComment {
  const c: WikiComment = { id: newClientId("c-"), slug, anchor, text: text.trim(), at: NOW, status: "open" };
  void mutate(
    withWiki((w) => ({ ...w, comments: [...w.comments, c] })),
    () => actions.addComment({ id: c.id, slug, anchor, text: c.text }),
  );
  return c;
}

export function updateComment(id: string, text: string) {
  void mutate(
    withWiki((w) => ({
      ...w,
      comments: w.comments.map((c) => (c.id === id ? { ...c, text: text.trim(), note: undefined } : c)),
    })),
    () => actions.updateComment(id, text),
  );
}

export function deleteComment(id: string) {
  void mutate(
    withWiki((w) => ({ ...w, comments: w.comments.filter((c) => c.id !== id) })),
    () => actions.deleteComment(id),
  );
}

/**
 * 열린 주석을 한 번에 Claude에게 넘김 → 고친 새 버전(작성자 Claude) → 모순 검토.
 * 바뀐 게 없으면 버전을 만들지 않고 주석에 메모만 남긴다. 결과는 서버에서 다시 불러온다.
 */
export async function requestClaudeEdit(slug: string): Promise<Revision | null> {
  const r = await mutate(null, () => actions.requestClaudeEdit(slug));
  await refresh();
  return r ?? null;
}

/* ───────── 복습 ───────── */

const setPageReview = (slug: string, review: WikiPage["review"]) =>
  withWiki((w) => ({ ...w, pages: w.pages.map((p) => (p.slug === slug ? { ...p, review } : p)) }));

/** 복습했음 → 다음 복습일이 뒤로 밀린다. 되돌리기용으로 이전 값을 돌려준다 */
export async function markReviewed(slug: string) {
  const prev = findPage(getWikiState(), slug)?.review;
  const res = await mutate(null, () => actions.markReviewed(slug));
  if (res) await mutate(setPageReview(slug, res.next), async () => undefined);
  return prev && res ? { prev, next: res.next } : null;
}

export function undoReviewed(slug: string, prev: WikiPage["review"]) {
  void mutate(setPageReview(slug, prev), () => actions.setReview(slug, prev));
}
