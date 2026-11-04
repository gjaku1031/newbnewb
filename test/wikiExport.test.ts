import { afterAll, beforeEach, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { exportWikiZip } from "@/server/services/wikiExport";
import { listWiki } from "@/server/services/wiki";
import { seedDemo } from "./fixtures/seed";
import { testDb } from "./db";

const { db, close } = testDb();
afterAll(close);
beforeEach(async () => {
  await seedDemo(db, { force: true });
});

it("위키 내보내기: 분류 폴더/slug.md + 목차, [[링크]]는 상대 경로 링크로", async () => {
  const { pages } = await listWiki(db);
  const { bytes, filename } = await exportWikiZip(db);
  expect(filename).toMatch(/^newb-wiki-\d{4}-\d{2}-\d{2}\.zip$/);
  const files = unzipSync(bytes);
  const md = Object.keys(files).filter((k) => k.endsWith(".md") && k !== "README.md");
  expect(md).toHaveLength(pages.length);

  const linked = pages.find((p) => /\[\[[a-z0-9-]+\]\]/.test(p.body))!;
  const target = linked.body.match(/\[\[([a-z0-9-]+)\]\]/)![1];
  const text = strFromU8(files[`${linked.category}/${linked.slug}.md`]);
  expect(text.startsWith(`# ${linked.title}\n`)).toBe(true);
  expect(text).not.toContain(`[[${target}]]`);
  if (pages.some((p) => p.slug === target)) expect(text).toMatch(new RegExp(`\\]\\(\\.\\./[^)]+/${target}\\.md\\)`));

  const readme = strFromU8(files["README.md"]);
  expect(readme).toContain(`페이지 ${pages.length}개`);
  expect(readme).toContain(`(${linked.category}/${linked.slug}.md)`);
});
