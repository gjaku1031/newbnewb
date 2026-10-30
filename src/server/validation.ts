import "server-only";
import { z } from "zod";
import { ID_PATTERN } from "@/server/ids";

/** 서버 액션은 누구나 POST로 부를 수 있어서, 들어오는 값은 전부 여기서 검증한다 */

export const Id = z.string().regex(ID_PATTERN);
export const Slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/);
const LocalDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
const LocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Short = (max: number) => z.string().max(max);

export const ItemInput = z.object({
  id: Id,
  title: z.string().trim().min(1).max(255),
  kind: z.enum(["event", "task"]),
  start: LocalDateTime.optional(),
  end: LocalDateTime.optional(),
  allDay: z.boolean().optional(),
  due: LocalDate.optional(),
  priority: z.enum(["P0", "P1", "P2", "P3", "P4", "P5"]).optional(),
  status: z.enum(["todo", "doing", "waiting", "done"]).optional(),
  tags: z.array(Id).max(50),
  subItems: z.array(z.object({ id: Id, title: Short(500), done: z.boolean() })).max(200),
  from: Short(255).optional(),
  description: Short(20_000).optional(),
  location: Short(255).optional(),
  wikiRefs: z.array(Slug).max(50),
  waitingFor: Short(500).optional(),
  brief: Short(20_000).optional(),
  createdAt: LocalDate,
});

export const TagInput = z.object({
  id: Id,
  label: z.string().trim().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{3,8}$/),
});

export const PageContentInput = z.object({
  title: z.string().trim().min(1).max(255),
  summary: Short(1000),
  body: Short(1_000_000),
});

export const RevisionInput = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  slug: Slug,
  after: PageContentInput,
  message: Short(500),
});

export const CommentInput = z.object({
  id: Id,
  slug: Slug,
  anchor: z.object({ quote: Short(2000), line: z.number().int().min(0) }).nullable(),
  text: z.string().trim().min(1).max(5000),
});

export const ReviewInput = z.object({
  nextReview: LocalDate,
  intervalDays: z.number().int().min(1).max(365),
  reviewCount: z.number().int().min(0),
});

export const MemoInput = z.object({ id: Id, text: z.string().trim().min(1).max(5000) });

export const SourceTypeInput = z.enum(["manual", "guideline", "boss_answer", "peer_advice", "note"]);

export const CautionInput = z.object({
  id: Id,
  point: z.string().trim().min(1).max(500),
  wrong: Short(1000).optional(),
  by: Short(50).optional(),
  source: z.object({
    kind: z.enum(["memo", "question", "wiki", "manual"]),
    id: z.string().max(128).optional(),
  }),
  wikiRefs: z.array(Slug).max(50),
  tags: z.array(Id).max(50),
  createdAt: LocalDate,
  review: z.object({ nextReview: LocalDate, intervalDays: z.number().int().min(1).max(365) }),
  archived: z.boolean().optional(),
});
