import "server-only";
import { z } from "zod";
import type { WikiEditor } from "@/lib/wikiEditor";
import type { EditNote, PageContent, WikiComment } from "@/lib/wikiTypes";
import { askClaude, CLAUDE_MODEL, ClaudeError, tag } from "./claude";

const EditSchema = z.object({
  title: z.string(),
  summary: z.string(),
  body: z.string(),
  edits: z.array(z.object({ commentId: z.string(), applied: z.boolean(), note: z.string() })),
});

const SYSTEM = `당신은 신입사원이 쓰는 회사 업무 위키의 편집자입니다.
사용자는 문서를 직접 고치지 않고 "어디를 어떻게 고쳐야 하는지" 주석을 답니다. 주석을 모두 읽고 문서를 고쳐 주세요.

규칙:
- 주석이 요청한 부분만 고친다. 나머지 문장·줄 순서·마크다운 서식·[[slug]] 링크는 그대로 둔다.
- 주석의 anchor는 사용자가 선택한 문장(quote)과 그 줄 번호(0부터)이다. 줄 번호보다 quote를 우선해 위치를 찾는다.
- 문서 전체에 대한 주석(anchor 없음)은 알맞은 위치에 반영한다.
- 주석끼리 충돌하거나, 무엇을 고치라는 건지 알 수 없거나, 고칠 위치를 찾지 못하면 그 주석은 반영하지 않는다.
- edits에는 모든 주석마다 하나씩: applied(반영했는지)와 note(무엇을 바꿨는지, 반영 못 했으면 그 이유)를 한국어 한 줄로.
- 제목·요약은 주석이 요청할 때만 바꾼다.`;

const numbered = (body: string) =>
  body
    .split("\n")
    .map((l, i) => `${i}| ${l}`)
    .join("\n");

export class ClaudeEditor implements WikiEditor {
  id = `claude-editor@${CLAUDE_MODEL}`;

  async apply(content: PageContent, comments: WikiComment[]): Promise<{ content: PageContent; edits: EditNote[] }> {
    const commentText = comments
      .map((c) =>
        tag("comment", c.text, {
          id: c.id,
          line: c.anchor?.line,
          quote: c.anchor?.quote,
        }),
      )
      .join("\n");
    const res = await askClaude({
      system: SYSTEM,
      content: [
        tag("title", content.title),
        tag("summary", content.summary),
        tag("body_with_line_numbers", numbered(content.body)),
        tag("comments", commentText),
        "주석을 반영한 제목·요약·본문 전체를 돌려 주세요. 본문에는 줄 번호(N| )를 붙이지 마세요.",
      ].join("\n\n"),
      schema: EditSchema,
      effort: "medium",
    });

    // DB 칸 크기를 넘으면 이번 결과를 쓰지 않는다 (잘라 쓰면 내용이 망가짐)
    if (res.title.length > 255 || res.summary.length > 1000) throw new ClaudeError("Claude가 만든 제목·요약이 너무 길어요");
    const byId = new Map(res.edits.map((e) => [e.commentId, e]));
    const edits: EditNote[] = comments.map((c) => {
      const e = byId.get(c.id);
      return e ? { commentId: c.id, applied: e.applied, note: e.note.trim() || (e.applied ? "반영함" : "반영하지 못함") } : { commentId: c.id, applied: false, note: "반영하지 못함" };
    });
    return { content: { title: res.title.trim() || content.title, summary: res.summary.trim() || content.summary, body: res.body }, edits };
  }
}

/** 위키 편집기 — Claude (키가 없으면 ClaudeUnavailableError) */
export const defaultEditor = (): WikiEditor => new ClaudeEditor();
