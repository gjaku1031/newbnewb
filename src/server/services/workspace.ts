import "server-only";
import type { WorkspaceSnapshot } from "@/lib/workspace";
import { seoulNow } from "@/lib/today";
import type { Exec } from "@/server/db/types";
import { listItems, listTags } from "./items";
import { listMemos } from "./memos";
import { latestBriefings, latestReschedule, listQuestions } from "./records";
import { listWiki } from "./wiki";
import { listCautions } from "./cautions";
import { claudeEnabled } from "@/server/ai/claude";
import { getSettings } from "./briefing";

/** 화면 전체가 쓰는 데이터를 한 번에 */
export async function loadWorkspace(db: Exec): Promise<WorkspaceSnapshot> {
  const version = Date.now();
  const [items, tags, wiki, memos, questions, cautions, briefing, reschedule, settings] = await Promise.all([
    listItems(db),
    listTags(db),
    listWiki(db),
    listMemos(db),
    listQuestions(db),
    listCautions(db),
    latestBriefings(db),
    latestReschedule(db),
    getSettings(db),
  ]);
  return { version, now: seoulNow(), items, tags, wiki, memos, questions, cautions, briefing, reschedule, claude: claudeEnabled(), settings };
}
