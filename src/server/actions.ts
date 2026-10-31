"use server";

/**
 * 서버 액션 — 화면의 저장·삭제는 모두 여기를 거친다.
 * 공통 순서: 로그인 확인 → 입력 검증 → 서비스 호출. 오래 걸리는 처리(검토·메모 처리)는 응답 뒤 after()로.
 */
import { after } from "next/server";
import { z } from "zod";
import type { Item } from "@/lib/types";
import type { Tag } from "@/lib/items";
import type { WikiComment } from "@/lib/wikiTypes";
import type { WikiReview } from "@/lib/types";
import { getDb } from "@/server/db/client";
import { requireUser } from "@/server/auth";
import * as v from "@/server/validation";
import * as itemsService from "@/server/services/items";
import * as wiki from "@/server/services/wiki";
import * as memosService from "@/server/services/memos";
import * as records from "@/server/services/records";
import * as cautionsService from "@/server/services/cautions";
import type { Caution } from "@/lib/types";

/** 응답을 보낸 뒤 실행 (실패해도 요청은 성공으로 끝나고, 서버 로그에 남긴다) */
function later(name: string, task: () => Promise<unknown>) {
  after(async () => {
    try {
      await task();
    } catch (error) {
      console.error(`[after] ${name} 실패`, error);
    }
  });
}

/* ───────── 항목 ───────── */

export async function saveItem(input: Item) {
  await requireUser();
  await itemsService.saveItem(getDb(), v.ItemInput.parse(input) as Item);
}

export async function deleteItem(id: string) {
  await requireUser();
  await itemsService.deleteItem(getDb(), v.Id.parse(id));
}

export async function addTag(input: Tag) {
  await requireUser();
  await itemsService.addTag(getDb(), v.TagInput.parse(input));
}

export async function removeTag(id: string) {
  await requireUser();
  await itemsService.removeTag(getDb(), v.Id.parse(id));
}

/* ───────── 위키 ───────── */

/** 반영했으면 true. 그 사이 문서가 바뀌었으면 false (변경은 확인 대기로 돌아간다) */
export async function applyRevision(id: string) {
  await requireUser();
  return wiki.applyRevision(getDb(), v.RevisionId.parse(id));
}

export async function cancelRevision(id: string) {
  await requireUser();
  await wiki.cancelRevision(getDb(), v.RevisionId.parse(id));
}

export async function addComment(input: { id: string; slug: string; anchor: WikiComment["anchor"]; text: string }) {
  await requireUser();
  await wiki.addComment(getDb(), v.CommentInput.parse(input));
}

export async function updateComment(id: string, text: string) {
  await requireUser();
  await wiki.updateComment(getDb(), v.Id.parse(id), z.string().trim().min(1).max(5000).parse(text));
}

export async function deleteComment(id: string) {
  await requireUser();
  await wiki.deleteComment(getDb(), v.Id.parse(id));
}

/** 열린 주석을 Claude(지금은 규칙 편집기)에게 넘겨 새 버전을 만든다 */
export async function requestClaudeEdit(slug: string) {
  await requireUser();
  const db = getDb();
  const r = await wiki.requestClaudeEdit(db, v.Slug.parse(slug));
  if (r) later("위키 검토", () => wiki.runReview(db, r.id));
  return r;
}

export async function markReviewed(slug: string) {
  await requireUser();
  return wiki.markReviewed(getDb(), v.Slug.parse(slug));
}

export async function setReview(slug: string, review: WikiReview) {
  await requireUser();
  await wiki.setReview(getDb(), v.Slug.parse(slug), v.ReviewInput.parse(review));
}

/* ───────── 메모 ───────── */

export async function addMemo(input: { id: string; text: string }) {
  await requireUser();
  const db = getDb();
  const memo = v.MemoInput.parse(input);
  await memosService.addMemo(db, memo);
  later("메모 처리", () => memosService.processMemo(db, memo.id));
}

/** 처리에 실패한 메모를 다시 정리 */
export async function retryMemo(id: string) {
  await requireUser();
  const db = getDb();
  const memoId = v.Id.parse(id);
  if (await memosService.retryMemo(db, memoId)) later("메모 처리", () => memosService.processMemo(db, memoId));
}

export async function deleteMemo(id: string) {
  await requireUser();
  await memosService.deleteMemo(getDb(), v.Id.parse(id));
}

/* ───────── 질문 · 재배치 ───────── */

export async function setQuestionFeedback(id: string, feedback: "up" | "down" | null) {
  await requireUser();
  await records.setQuestionFeedback(getDb(), v.Id.parse(id), z.enum(["up", "down"]).nullable().parse(feedback));
}

export async function answerMissing(id: string, index: number, answer: string) {
  await requireUser();
  return records.answerMissing(
    getDb(),
    v.Id.parse(id),
    z.number().int().min(0).max(100).parse(index),
    z.string().trim().min(1).max(5000).parse(answer),
  );
}

export async function applyReschedule(id: string, acceptedItemIds: string[]) {
  await requireUser();
  return records.applyReschedule(getDb(), v.Id.parse(id), z.array(v.Id).max(200).parse(acceptedItemIds));
}

/* ───────── 주의할 점 ───────── */

/** 추가·수정 모두 통째로 저장 (화면에서 id·날짜를 정해 보낸다) */
export async function saveCaution(input: Caution) {
  await requireUser();
  await cautionsService.saveCaution(getDb(), v.CautionInput.parse(input) as Caution);
}

export async function deleteCaution(id: string) {
  await requireUser();
  await cautionsService.deleteCaution(getDb(), v.Id.parse(id));
}

/** 다시 봤어요 — 다음 날짜는 서버가 정한다 */
export async function reviewCaution(id: string) {
  await requireUser();
  return cautionsService.reviewCaution(getDb(), v.Id.parse(id));
}

export async function setCautionArchived(id: string, archived: boolean) {
  await requireUser();
  await cautionsService.setCautionArchived(getDb(), v.Id.parse(id), z.boolean().parse(archived));
}
