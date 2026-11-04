import {
  bigint,
  boolean,
  char,
  date,
  datetime,
  double,
  index,
  int,
  json,
  mediumtext,
  mysqlTable,
  primaryKey,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import type { MissingItem, QuestionRecord, RescheduleItem, SourceWikiResult, SourceWikiStatus, WikiPage } from "@/lib/types";
import type { Conflict, EditNote, PageContent, WikiComment } from "@/lib/wikiTypes";
import type { MemoResult, MemoStatus } from "@/lib/memoTypes";

/*
 * 날짜·시간 규칙
 * - 화면 시간("YYYY-MM-DDTHH:mm")은 한국 시간 기준 벽시계 값이라 시간대 없는 DATETIME에 그대로 저장
 * - 날짜("YYYY-MM-DD")는 DATE
 * - created_at / updated_at 같은 기록용 시각만 CURRENT_TIMESTAMP(3)
 */

const createdAt = () => datetime("created_at", { mode: "string", fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`);
const updatedAt = () =>
  datetime("updated_at", { mode: "string", fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`)
    .$onUpdate(() => sql`CURRENT_TIMESTAMP(3)`);

/* ───────── 항목 (일정 + 할 일) ───────── */

export const tags = mysqlTable("tags", {
  id: varchar("id", { length: 64 }).primaryKey(),
  label: varchar("label", { length: 50 }).notNull(),
  color: varchar("color", { length: 16 }).notNull(),
  sort: int("sort").notNull().default(0),
});

export const items = mysqlTable(
  "items",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    kind: varchar("kind", { length: 8 }).$type<"event" | "task">().notNull(),
    startAt: datetime("start_at", { mode: "string" }),
    endAt: datetime("end_at", { mode: "string" }),
    allDay: boolean("all_day").notNull().default(false),
    due: date("due", { mode: "string" }),
    priority: varchar("priority", { length: 2 }),
    status: varchar("status", { length: 8 }),
    fromText: varchar("from_text", { length: 255 }),
    description: text("description"),
    location: varchar("location", { length: 255 }),
    waitingFor: varchar("waiting_for", { length: 500 }),
    brief: text("brief"),
    createdOn: date("created_on", { mode: "string" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("items_start_idx").on(t.startAt), index("items_due_idx").on(t.due)],
);

export const itemSubItems = mysqlTable(
  "item_sub_items",
  {
    itemId: varchar("item_id", { length: 64 })
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    id: varchar("id", { length: 64 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    done: boolean("done").notNull().default(false),
    sort: int("sort").notNull(),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.id] })],
);

export const itemTags = mysqlTable(
  "item_tags",
  {
    itemId: varchar("item_id", { length: 64 })
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    tagId: varchar("tag_id", { length: 64 })
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    sort: int("sort").notNull(),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.tagId] })],
);

export const itemWikiRefs = mysqlTable(
  "item_wiki_refs",
  {
    itemId: varchar("item_id", { length: 64 })
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 128 })
      .notNull()
      .references(() => wikiPages.slug, { onDelete: "cascade" }),
    sort: int("sort").notNull(),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.slug] })],
);

/* ───────── 원본 문서 · 위키 ───────── */

/** 원본 문서. 파일은 Object Storage, DB에는 메타데이터만 */
export const sources = mysqlTable("sources", {
  id: varchar("id", { length: 64 }).primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  type: varchar("type", { length: 16 }).notNull(),
  fileType: varchar("file_type", { length: 8 }).notNull(),
  addedOn: date("added_on", { mode: "string" }).notNull(),
  // 파일을 올린 경우만 (목데이터 원본은 파일 없음)
  objectKey: varchar("object_key", { length: 512 }).unique(),
  contentType: varchar("content_type", { length: 255 }),
  sizeBytes: bigint("size_bytes", { mode: "number", unsigned: true }),
  sha256: char("sha256", { length: 64 }),
  /** 서버 전용: 자료를 준 사람 (화면에는 보내지 않음) */
  author: varchar("author", { length: 100 }),
  /** 원본에서 뽑은 글자 (docx·xlsx·pptx·hwp·hwpx·텍스트). PDF·이미지는 Claude가 파일을 직접 읽어 null */
  text: mediumtext("text"),
  /** 위키로 정리: processing → done | failed (예전 원본·목데이터는 null) */
  wikiStatus: varchar("wiki_status", { length: 12 }).$type<SourceWikiStatus>(),
  wikiResult: json("wiki_result").$type<SourceWikiResult>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const wikiPages = mysqlTable("wiki_pages", {
  slug: varchar("slug", { length: 128 }).primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  summary: varchar("summary", { length: 1000 }).notNull(),
  body: mediumtext("body").notNull(),
  createdOn: date("created_on", { mode: "string" }).notNull(),
  updatedOn: date("updated_on", { mode: "string" }).notNull(),
  nextReview: date("next_review", { mode: "string" }).notNull(),
  intervalDays: int("interval_days").notNull(),
  reviewCount: int("review_count").notNull().default(0),
  issues: json("issues").$type<NonNullable<WikiPage["issues"]>>(),
  /** 서버 전용: 인용 출처 같은 내부 메모 (화면에는 보내지 않음) */
  internalNotes: json("internal_notes").$type<string[]>(),
  updatedAt: updatedAt(),
});

export const wikiPageSources = mysqlTable(
  "wiki_page_sources",
  {
    slug: varchar("slug", { length: 128 })
      .notNull()
      .references(() => wikiPages.slug, { onDelete: "cascade" }),
    sourceId: varchar("source_id", { length: 64 })
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    sort: int("sort").notNull(),
  },
  (t) => [primaryKey({ columns: [t.slug, t.sourceId] })],
);

/** 페이지 간 연결 (대상 페이지는 아직 없을 수도 있어 FK 없음) */
export const wikiLinks = mysqlTable(
  "wiki_links",
  {
    fromSlug: varchar("from_slug", { length: 128 })
      .notNull()
      .references(() => wikiPages.slug, { onDelete: "cascade" }),
    toSlug: varchar("to_slug", { length: 128 }).notNull(),
    sort: int("sort").notNull(),
  },
  (t) => [primaryKey({ columns: [t.fromSlug, t.toSlug] })],
);

/** 위키 변경 요청 = 커밋 하나 */
export const wikiRevisions = mysqlTable(
  "wiki_revisions",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    slug: varchar("slug", { length: 128 })
      .notNull()
      .references(() => wikiPages.slug, { onDelete: "cascade" }),
    version: int("version").notNull(),
    at: datetime("at", { mode: "string" }).notNull(),
    author: varchar("author", { length: 8 }).$type<"me" | "claude">().notNull(),
    status: varchar("status", { length: 12 }).$type<"reviewing" | "pending" | "applied" | "cancelled">().notNull(),
    message: varchar("message", { length: 500 }).notNull(),
    before: json("before").$type<PageContent>().notNull(),
    after: json("after").$type<PageContent>().notNull(),
    conflicts: json("conflicts").$type<Conflict[]>().notNull(),
    commentIds: json("comment_ids").$type<string[]>(),
    edits: json("edits").$type<EditNote[]>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("wiki_revisions_slug_version").on(t.slug, t.version), index("wiki_revisions_status_idx").on(t.status)],
);

export const wikiComments = mysqlTable("wiki_comments", {
  id: varchar("id", { length: 64 }).primaryKey(),
  slug: varchar("slug", { length: 128 })
    .notNull()
    .references(() => wikiPages.slug, { onDelete: "cascade" }),
  anchor: json("anchor").$type<WikiComment["anchor"]>(),
  text: text("text").notNull(),
  at: datetime("at", { mode: "string" }).notNull(),
  status: varchar("status", { length: 12 }).$type<WikiComment["status"]>().notNull(),
  revisionId: varchar("revision_id", { length: 128 }).references(() => wikiRevisions.id, { onDelete: "set null" }),
  note: varchar("note", { length: 500 }),
});

/* ───────── 주의할 점 (실수·지적 노트) ───────── */

export const cautions = mysqlTable("cautions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  /** 주의할 점 한 줄 (맞는 방법 중심) */
  point: varchar("point", { length: 500 }).notNull(),
  /** 무엇이 문제였는지 */
  wrong: varchar("wrong", { length: 1000 }),
  /** 지적한 사람의 직책만 (이름은 남기지 않음) */
  byRole: varchar("by_role", { length: 50 }),
  sourceKind: varchar("source_kind", { length: 12 }).$type<"memo" | "question" | "wiki" | "manual">().notNull(),
  sourceId: varchar("source_id", { length: 128 }),
  createdOn: date("created_on", { mode: "string" }).notNull(),
  nextReview: date("next_review", { mode: "string" }).notNull(),
  intervalDays: int("interval_days").notNull(),
  /** 충분히 익혀서 더는 알려주지 않음 */
  archived: boolean("archived").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const cautionWiki = mysqlTable(
  "caution_wiki",
  {
    cautionId: varchar("caution_id", { length: 64 })
      .notNull()
      .references(() => cautions.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 128 })
      .notNull()
      .references(() => wikiPages.slug, { onDelete: "cascade" }),
    sort: int("sort").notNull(),
  },
  (t) => [primaryKey({ columns: [t.cautionId, t.slug] })],
);

export const cautionTags = mysqlTable(
  "caution_tags",
  {
    cautionId: varchar("caution_id", { length: 64 })
      .notNull()
      .references(() => cautions.id, { onDelete: "cascade" }),
    tagId: varchar("tag_id", { length: 64 })
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    sort: int("sort").notNull(),
  },
  (t) => [primaryKey({ columns: [t.cautionId, t.tagId] })],
);

/* ───────── 메모 · 질문 · 재배치 · 브리핑 ───────── */

export const memos = mysqlTable("memos", {
  id: varchar("id", { length: 64 }).primaryKey(),
  text: text("text").notNull(),
  at: datetime("at", { mode: "string" }).notNull(),
  status: varchar("status", { length: 12 }).$type<MemoStatus>().notNull(),
  result: json("result").$type<MemoResult>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const questions = mysqlTable("questions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  askedAt: datetime("asked_at", { mode: "string" }).notNull(),
  question: text("question").notNull(),
  verdict: varchar("verdict", { length: 24 }).$type<QuestionRecord["verdict"]>().notNull(),
  confidence: double("confidence").notNull(),
  rationale: text("rationale").notNull(),
  answer: text("answer"),
  citations: json("citations").$type<QuestionRecord["citations"]>().notNull(),
  missing: json("missing").$type<MissingItem[]>().notNull(),
  status: varchar("status", { length: 12 }).$type<QuestionRecord["status"]>().notNull(),
  itemId: varchar("item_id", { length: 64 }).references(() => items.id, { onDelete: "set null" }),
  feedback: varchar("feedback", { length: 4 }).$type<"up" | "down">(),
  modelId: varchar("model_id", { length: 64 }).notNull(),
});

export const rescheduleProposals = mysqlTable("reschedule_proposals", {
  id: varchar("id", { length: 64 }).primaryKey(),
  at: datetime("at", { mode: "string" }).notNull(),
  summary: text("summary").notNull(),
  items: json("items").$type<RescheduleItem[]>().notNull(),
  appliedAt: datetime("applied_at", { mode: "string", fsp: 3 }),
});

/** 아침·저녁 브리핑 (하루 한 번 생성, 내용은 JSON) */
export const briefings = mysqlTable(
  "briefings",
  {
    kind: varchar("kind", { length: 8 }).$type<"morning" | "evening">().notNull(),
    date: date("date", { mode: "string" }).notNull(),
    generatedAt: datetime("generated_at", { mode: "string" }).notNull(),
    payload: json("payload").notNull(),
  },
  (t) => [primaryKey({ columns: [t.kind, t.date] })],
);

/** 서버 전용: 사람 (화면에는 직책만, 이름은 Claude 답변용) */
export const people = mysqlTable("people", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  role: varchar("role", { length: 50 }).notNull(),
});

/* ───────── 로그인 (Passkey, 1인용) ───────── */
/* 만료 시각 비교는 모두 DB 시각(CURRENT_TIMESTAMP)으로 — 서버·DB 시간대 차이에 흔들리지 않게 */

/** 등록한 Passkey. id는 WebAuthn credential ID(base64url) */
export const passkeys = mysqlTable("passkeys", {
  id: varchar("id", { length: 255 }).primaryKey(),
  /** COSE 공개키 (base64url) */
  publicKey: text("public_key").notNull(),
  counter: bigint("counter", { mode: "number", unsigned: true }).notNull().default(0),
  transports: json("transports").$type<string[]>(),
  deviceType: varchar("device_type", { length: 16 }).notNull(),
  backedUp: boolean("backed_up").notNull(),
  /** 등록한 기기 이름 (User-Agent로 추정: iPhone, Mac …) */
  name: varchar("name", { length: 100 }).notNull(),
  createdAt: createdAt(),
  lastUsedAt: datetime("last_used_at", { mode: "string", fsp: 3 }),
});

/** 로그인 세션. 쿠키에는 원래 값, DB에는 SHA-256만 */
export const authSessions = mysqlTable(
  "auth_sessions",
  {
    idHash: char("id_hash", { length: 64 }).primaryKey(),
    /** 이 세션을 만든 Passkey — 지우면 그 Passkey로 연 세션도 같이 끝난다 */
    passkeyId: varchar("passkey_id", { length: 255 })
      .notNull()
      .references(() => passkeys.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    expiresAt: datetime("expires_at", { mode: "string", fsp: 3 }).notNull(),
  },
  (t) => [index("auth_sessions_expires").on(t.expiresAt)],
);

/** 등록·로그인 도전값 (한 번 쓰면 지움) */
export const authChallenges = mysqlTable(
  "auth_challenges",
  {
    id: char("id", { length: 32 }).primaryKey(),
    challenge: varchar("challenge", { length: 128 }).notNull(),
    purpose: varchar("purpose", { length: 12 }).$type<"register" | "login">().notNull(),
    expiresAt: datetime("expires_at", { mode: "string", fsp: 3 }).notNull(),
  },
  (t) => [index("auth_challenges_expires").on(t.expiresAt)],
);

/** 첫 Passkey(또는 로그인할 수 없을 때 새 Passkey) 등록용 1회 초대. 서버에서 CLI로만 만든다 */
export const authInvites = mysqlTable("auth_invites", {
  tokenHash: char("token_hash", { length: 64 }).primaryKey(),
  createdAt: createdAt(),
  expiresAt: datetime("expires_at", { mode: "string", fsp: 3 }).notNull(),
  usedAt: datetime("used_at", { mode: "string", fsp: 3 }),
});

/* ───────── 설정·예약 작업 ───────── */

/** 1인용 설정 (id = 1 한 줄) */
export const userSettings = mysqlTable("user_settings", {
  id: int("id").primaryKey(),
  /** 아침 브리핑을 만들 시각 (한국 시간 HH:mm) */
  morningTime: varchar("morning_time", { length: 5 }).notNull().default("08:00"),
  /** 브리핑을 만들 요일 (0=일 … 6=토) */
  days: json("days").$type<number[]>().notNull(),
  updatedAt: updatedAt(),
});

/** 예약 작업을 하루 한 번만 돌리기 위한 기록 — (작업, 날짜)를 먼저 넣은 쪽만 실행 */
export const scheduledRuns = mysqlTable(
  "scheduled_runs",
  {
    job: varchar("job", { length: 32 }).notNull(),
    runDate: date("run_date", { mode: "string" }).notNull(),
    startedAt: createdAt(),
    finishedAt: datetime("finished_at", { mode: "string", fsp: 3 }),
    error: varchar("error", { length: 500 }),
  },
  (t) => [primaryKey({ columns: [t.job, t.runDate] })],
);

/* ───────── Claude Desktop 연결 (MCP + OAuth) ───────── */
/* 코드·토큰은 원래 값이 아니라 SHA-256만 저장한다 */

/** 동적 등록한 OAuth 클라이언트 (Claude) */
export const oauthClients = mysqlTable("oauth_clients", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  redirectUris: json("redirect_uris").$type<string[]>().notNull(),
  createdAt: createdAt(),
});

/** 승인 코드 (5분, 한 번) */
export const oauthCodes = mysqlTable("oauth_codes", {
  codeHash: char("code_hash", { length: 64 }).primaryKey(),
  clientId: varchar("client_id", { length: 64 })
    .notNull()
    .references(() => oauthClients.id, { onDelete: "cascade" }),
  redirectUri: varchar("redirect_uri", { length: 1000 }).notNull(),
  codeChallenge: varchar("code_challenge", { length: 128 }).notNull(),
  scope: varchar("scope", { length: 200 }),
  resource: varchar("resource", { length: 500 }),
  expiresAt: datetime("expires_at", { mode: "string", fsp: 3 }).notNull(),
});

/** 접근·갱신 토큰. grantId = 한 번의 승인에서 나온 토큰 묶음 (갱신·연결 끊기 단위) */
export const oauthTokens = mysqlTable(
  "oauth_tokens",
  {
    tokenHash: char("token_hash", { length: 64 }).primaryKey(),
    kind: varchar("kind", { length: 8 }).$type<"access" | "refresh">().notNull(),
    grantId: char("grant_id", { length: 32 }).notNull(),
    clientId: varchar("client_id", { length: 64 })
      .notNull()
      .references(() => oauthClients.id, { onDelete: "cascade" }),
    scope: varchar("scope", { length: 200 }),
    resource: varchar("resource", { length: 500 }),
    expiresAt: datetime("expires_at", { mode: "string", fsp: 3 }).notNull(),
    lastUsedAt: datetime("last_used_at", { mode: "string", fsp: 3 }),
    createdAt: createdAt(),
  },
  (t) => [index("oauth_tokens_grant").on(t.grantId), index("oauth_tokens_expires").on(t.expiresAt)],
);
