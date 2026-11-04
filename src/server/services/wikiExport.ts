import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { strToU8, zipSync, type Zippable } from "fflate";
import { seoulToday } from "@/lib/today";
import { sources, wikiPages, wikiPageSources } from "@/server/db/schema";
import type { Exec } from "@/server/db/types";

/**
 * 위키 내보내기: 분류 폴더 / slug.md (머리에 제목·요약·근거 원본) + 목차 README.md를 zip 하나로.
 * [[slug]] 링크는 다른 마크다운 편집기에서도 열리게 상대 경로 링크로 바꾼다.
 */
export async function exportWikiZip(db: Exec): Promise<{ bytes: Uint8Array; filename: string }> {
  const pages = await db
    .select({ slug: wikiPages.slug, title: wikiPages.title, category: wikiPages.category, summary: wikiPages.summary, body: wikiPages.body, updatedOn: wikiPages.updatedOn })
    .from(wikiPages)
    .orderBy(asc(wikiPages.category), asc(wikiPages.title));
  const links = pages.length
    ? await db
        .select({ slug: wikiPageSources.slug, title: sources.title })
        .from(wikiPageSources)
        .innerJoin(sources, eq(sources.id, wikiPageSources.sourceId))
        .where(inArray(wikiPageSources.slug, pages.map((p) => p.slug)))
        .orderBy(asc(wikiPageSources.sort))
    : [];

  const folder = (category: string) => category.replace(/[\\/:*?"<>|]+/g, "_").trim() || "일반";
  const pathOf = new Map(pages.map((p) => [p.slug, `${folder(p.category)}/${p.slug}.md`]));
  const titleOf = new Map(pages.map((p) => [p.slug, p.title]));
  const sourcesOf = (slug: string) => links.filter((l) => l.slug === slug).map((l) => l.title);

  const files: Zippable = {};
  for (const p of pages) {
    const body = p.body.replace(/\[\[([^\]|]+)\]\]/g, (_, slug: string) =>
      pathOf.has(slug) ? `[${titleOf.get(slug)}](../${pathOf.get(slug)})` : slug,
    );
    const src = sourcesOf(p.slug);
    const head = [`# ${p.title}`, "", `> ${p.summary}`, "", `- 분류: ${p.category}`, `- 마지막 수정: ${p.updatedOn}`];
    if (src.length) head.push(`- 근거 원본: ${src.join(", ")}`);
    files[pathOf.get(p.slug)!] = strToU8(`${head.join("\n")}\n\n---\n\n${body}\n`);
  }

  const byCategory = new Map<string, typeof pages>();
  for (const p of pages) byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), p]);
  const index = [`# newb 위키 (${seoulToday()} 내보냄)`, "", `페이지 ${pages.length}개`, ""];
  for (const [category, list] of byCategory) {
    index.push(`## ${category}`, "", ...list.map((p) => `- [${p.title}](${pathOf.get(p.slug)}) — ${p.summary}`), "");
  }
  files["README.md"] = strToU8(index.join("\n"));

  return { bytes: zipSync(files, { level: 6 }), filename: `newb-wiki-${seoulToday()}.zip` };
}
