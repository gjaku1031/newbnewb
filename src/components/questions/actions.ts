"use client";

import type { QuestionRecord } from "@/lib/types";
import type { WorkspaceSnapshot } from "@/lib/workspace";
import { mutate } from "@/components/workspace/store";
import * as actions from "@/server/actions";

const patchQuestion =
  (id: string, fn: (q: QuestionRecord) => QuestionRecord) =>
  (s: WorkspaceSnapshot): WorkspaceSnapshot => ({
    ...s,
    questions: s.questions.map((q) => (q.id === id ? fn(q) : q)),
  });

/** 판정 피드백 (👍/👎, 다시 누르면 취소) */
export function setFeedback(id: string, feedback: "up" | "down" | undefined) {
  void mutate(
    patchQuestion(id, (q) => ({ ...q, feedback })),
    () => actions.setQuestionFeedback(id, feedback ?? null),
  );
}

/** 알아온 답 기록 */
export function answerMissing(id: string, index: number, answer: string) {
  void mutate(
    patchQuestion(id, (q) => {
      const missing = q.missing.map((m, i) => (i === index ? { ...m, done: true, answer: answer.trim() } : m));
      return { ...q, missing, status: missing.every((m) => m.done) ? "resolved" : q.status };
    }),
    () => actions.answerMissing(id, index, answer),
  );
}
