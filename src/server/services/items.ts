import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import type { Tag } from "@/lib/items";
import type { Item, ItemStatus, Priority } from "@/lib/types";
import { itemSubItems, items, itemTags, itemWikiRefs, tags } from "@/server/db/schema";
import { dOut, dtIn, dtOut, opt } from "@/server/db/convert";
import type { Db, Exec } from "@/server/db/types";

/* ───────── 조회 ───────── */

export async function listTags(db: Exec): Promise<Tag[]> {
  const rows = await db.select().from(tags).orderBy(asc(tags.sort), asc(tags.id));
  return rows.map((t) => ({ id: t.id, label: t.label, color: t.color }));
}

export async function listItems(db: Exec, ids?: string[]): Promise<Item[]> {
  if (ids && ids.length === 0) return [];
  const where = ids ? inArray(items.id, ids) : undefined;
  const rows = await db.select().from(items).where(where).orderBy(asc(items.createdOn), asc(items.id));
  if (rows.length === 0) return [];
  const itemIds = rows.map((r) => r.id);
  const [subs, tagRows, refs] = await Promise.all([
    db.select().from(itemSubItems).where(inArray(itemSubItems.itemId, itemIds)).orderBy(asc(itemSubItems.sort)),
    db.select().from(itemTags).where(inArray(itemTags.itemId, itemIds)).orderBy(asc(itemTags.sort)),
    db.select().from(itemWikiRefs).where(inArray(itemWikiRefs.itemId, itemIds)).orderBy(asc(itemWikiRefs.sort)),
  ]);
  const group = <T extends { itemId: string }>(list: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of list) m.set(x.itemId, [...(m.get(x.itemId) ?? []), x]);
    return m;
  };
  const subsBy = group(subs);
  const tagsBy = group(tagRows);
  const refsBy = group(refs);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    kind: r.kind,
    start: dtOut(r.startAt),
    end: dtOut(r.endAt),
    allDay: r.allDay || undefined,
    due: dOut(r.due),
    priority: opt(r.priority) as Priority | undefined,
    status: opt(r.status) as ItemStatus | undefined,
    tags: (tagsBy.get(r.id) ?? []).map((t) => t.tagId),
    subItems: (subsBy.get(r.id) ?? []).map((s) => ({ id: s.id, title: s.title, done: s.done })),
    from: opt(r.fromText),
    description: opt(r.description),
    location: opt(r.location),
    wikiRefs: (refsBy.get(r.id) ?? []).map((w) => w.slug),
    waitingFor: opt(r.waitingFor),
    brief: opt(r.brief),
    createdAt: dOut(r.createdOn)!,
  }));
}

export async function getItem(db: Exec, id: string): Promise<Item | undefined> {
  const [it] = await listItems(db, [id]);
  return it;
}

/* ───────── 저장 ───────── */

/** 항목 하나를 통째로 저장 (하위 항목·태그·위키 연결은 갈아끼움) */
export async function saveItem(db: Db, item: Item) {
  await db.transaction(async (tx) => {
    await writeItem(tx, item);
  });
}

export async function writeItem(tx: Exec, item: Item) {
  const row = {
    id: item.id,
    title: item.title,
    kind: item.kind,
    startAt: dtIn(item.start),
    endAt: dtIn(item.end),
    allDay: item.allDay ?? false,
    due: item.due ?? null,
    priority: item.priority ?? null,
    status: item.status ?? null,
    fromText: item.from ?? null,
    description: item.description ?? null,
    location: item.location ?? null,
    waitingFor: item.waitingFor ?? null,
    brief: item.brief ?? null,
    createdOn: item.createdAt,
  };
  const { id: _id, createdOn: _created, ...update } = row;
  void _id;
  void _created;
  await tx.insert(items).values(row).onDuplicateKeyUpdate({ set: update });

  await tx.delete(itemSubItems).where(eq(itemSubItems.itemId, item.id));
  await tx.delete(itemTags).where(eq(itemTags.itemId, item.id));
  await tx.delete(itemWikiRefs).where(eq(itemWikiRefs.itemId, item.id));
  if (item.subItems.length) {
    await tx
      .insert(itemSubItems)
      .values(item.subItems.map((s, sort) => ({ itemId: item.id, id: s.id, title: s.title, done: s.done, sort })));
  }
  const tagIds = [...new Set(item.tags)];
  if (tagIds.length) {
    await tx.insert(itemTags).values(tagIds.map((tagId, sort) => ({ itemId: item.id, tagId, sort })));
  }
  const slugs = [...new Set(item.wikiRefs)];
  if (slugs.length) {
    await tx.insert(itemWikiRefs).values(slugs.map((slug, sort) => ({ itemId: item.id, slug, sort })));
  }
}

export async function deleteItem(db: Exec, id: string) {
  await db.delete(items).where(eq(items.id, id));
}

export async function addTag(db: Exec, tag: Tag) {
  const existing = await db.select({ sort: tags.sort }).from(tags);
  const sort = existing.reduce((m, t) => Math.max(m, t.sort), -1) + 1;
  await db.insert(tags).values({ ...tag, sort });
}

/** 태그 삭제 — 항목에 붙은 태그는 FK cascade로 함께 빠진다 */
export async function removeTag(db: Exec, id: string) {
  await db.delete(tags).where(eq(tags.id, id));
}
