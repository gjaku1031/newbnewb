import "server-only";
import type { WorkspaceSnapshot } from "@/lib/workspace";
import { seoulNow } from "@/lib/today";
import type { Exec } from "@/server/db/types";
import { listItems, listTags } from "./items";
import { listMemos } from "./memos";
import { latestBriefings, latestReschedule, listQuestions } from "./records";
import { listWiki } from "./wiki";

/** 화면 전체가 쓰는 데이터를 한 번에 */
export async function loadWorkspace(db: Exec): Promise<WorkspaceSnapshot> {
  const version = Date.now();
  const [items, tags, wiki, memos, questions, briefing, reschedule] = await Promise.all([
    listItems(db),
    listTags(db),
    listWiki(db),
    listMemos(db),
    listQuestions(db),
    latestBriefings(db),
    latestReschedule(db),
  ]);
  return { version, now: seoulNow(), items, tags, wiki, memos, questions, briefing, reschedule };
}
