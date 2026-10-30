import "server-only";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/server/db/client";
import { items, questions, wikiPages } from "@/server/db/schema";

/**
 * 페이지 제목(메타데이터)·존재 확인용 가벼운 조회.
 * 로그인하지 않았으면 아무것도 알려주지 않는다 (제목도 개인 데이터).
 */
async function signedIn() {
  await connection();
  return !!(await getCurrentUser());
}

export async function wikiTitle(slug: string) {
  if (!(await signedIn())) return undefined;
  const [p] = await getDb().select({ title: wikiPages.title }).from(wikiPages).where(eq(wikiPages.slug, slug));
  return p?.title;
}

export async function itemTitle(id: string) {
  if (!(await signedIn())) return undefined;
  const [it] = await getDb().select({ title: items.title }).from(items).where(eq(items.id, id));
  return it?.title;
}

export async function questionTitle(id: string) {
  if (!(await signedIn())) return undefined;
  const [q] = await getDb().select({ question: questions.question }).from(questions).where(eq(questions.id, id));
  return q?.question;
}
