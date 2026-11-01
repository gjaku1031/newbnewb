import type { EditNote, PageContent, WikiComment } from "@/lib/wikiTypes";
import { plainLine, type TitleOf } from "@/lib/markdownText";

/**
 * 주석대로 문서를 고치는 편집기 인터페이스. 운영에선 Claude(src/server/ai/wikiEdit.ts)가 주석을 읽고 문서를 고친다.
 * API 키가 없으면 아래 패턴 목업.
 */
export interface WikiEditor {
  id: string;
  apply(
    content: PageContent,
    comments: WikiComment[],
    titleOf?: TitleOf,
  ): Promise<{ content: PageContent; edits: EditNote[] }>;
}

const clip = (s: string, n = 24) => (s.length > n ? `${s.slice(0, n)}…` : s);
const unquote = (s: string) =>
  s
    .trim()
    .replace(/^["'“”‘’「」]+|["'“”‘’「」.]+$/g, "")
    .trim();

/** 목업: 주석 문장 패턴으로 고친다 */
export class PatternEditor implements WikiEditor {
  id = "pattern-editor@v1";

  async apply(content: PageContent, comments: WikiComment[], titleOf?: TitleOf) {
    const lines = content.body.split("\n");
    const edits: EditNote[] = [];
    // 아래 줄부터 고쳐야 줄 번호가 안 밀린다 (추가·삭제)
    const ordered = [...comments].sort((a, b) => (b.anchor?.line ?? -1) - (a.anchor?.line ?? -1));

    const findLine = (c: WikiComment, needle: string) => {
      if (c.anchor && lines[c.anchor.line] !== undefined) {
        const l = lines[c.anchor.line];
        if (l.includes(needle) || plainLine(l, titleOf).includes(needle)) return c.anchor.line;
      }
      return lines.findIndex((l) => l.includes(needle) || plainLine(l, titleOf).includes(needle));
    };

    const replaceIn = (idx: number, a: string, b: string) => {
      const raw = lines[idx];
      if (raw.includes(a)) lines[idx] = raw.replace(a, b);
      else {
        // 서식(**굵게** 등) 때문에 그대로 안 보이면 서식을 걷어낸 줄에서 바꾼다
        const prefix = raw.match(/^\s*(#{1,6}\s|>\s?|-\s|\d+\.\s)/)?.[0] ?? "";
        lines[idx] = prefix + plainLine(raw, titleOf).replace(a, b);
      }
    };

    for (const c of ordered) {
      const t = c.text.trim();
      let m: RegExpMatchArray | null;

      // 1) "A → B", "A -> B", "A 말고 B"
      if (
        (m = t.match(/^(.+?)\s*(?:→|->|=>)\s*(.+)$/)) ||
        (m = t.match(/^(.+?)\s+말고\s+(.+?)(?:로|으로)?(?:\s*(?:해|바꿔|수정|변경|고쳐).*)?$/))
      ) {
        const a = unquote(m[1]);
        const b = unquote(m[2]);
        const idx = findLine(c, a);
        if (idx === -1) edits.push({ commentId: c.id, note: `'${clip(a)}' 찾지 못함`, applied: false });
        else {
          replaceIn(idx, a, b);
          edits.push({ commentId: c.id, note: `'${clip(a)}' → '${clip(b)}'`, applied: true });
        }
        continue;
      }

      // 2) 삭제 / 빼 / 지워
      if (/(삭제|빼|지워|없애)/.test(t) && c.anchor) {
        const q = c.anchor.quote.trim();
        const idx = findLine(c, q);
        if (idx === -1) {
          edits.push({ commentId: c.id, note: `'${clip(q)}' 찾지 못함`, applied: false });
        } else if (plainLine(lines[idx], titleOf).trim() === q || q.length >= plainLine(lines[idx], titleOf).trim().length - 2) {
          lines.splice(idx, 1);
          edits.push({ commentId: c.id, note: `'${clip(q)}' 줄 삭제`, applied: true });
        } else {
          replaceIn(idx, q, "");
          lines[idx] = lines[idx].replace(/\s{2,}/g, " ");
          edits.push({ commentId: c.id, note: `'${clip(q)}' 삭제`, applied: true });
        }
        continue;
      }

      // 3) "B로 바꿔 / 수정 / 변경 / 고쳐" — 선택한 부분을 B로
      if ((m = t.match(/^(.+?)(?:으로|로)\s*(?:바꿔|수정|변경|고쳐)/)) && c.anchor) {
        const b = unquote(m[1]);
        const q = c.anchor.quote.trim();
        const idx = findLine(c, q);
        if (idx === -1) edits.push({ commentId: c.id, note: `'${clip(q)}' 찾지 못함`, applied: false });
        else {
          replaceIn(idx, q, b);
          edits.push({ commentId: c.id, note: `'${clip(q)}' → '${clip(b)}'`, applied: true });
        }
        continue;
      }

      // 4) 그 외: 해당 위치 아래(문서 전체 주석이면 맨 끝)에 내용 추가
      const addition = t.replace(/\s*(추가해\s*줘|추가해|추가|넣어\s*줘|넣어|적어\s*줘|적어)\s*\.?$/, "").trim();
      if (c.anchor && lines[c.anchor.line] !== undefined) {
        const at = c.anchor.line;
        const isList = /^\s*-\s/.test(lines[at]);
        lines.splice(at + 1, 0, isList ? `- ${addition}` : addition);
      } else {
        while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
        lines.push("", addition);
      }
      edits.push({ commentId: c.id, note: `'${clip(addition)}' 추가`, applied: true });
    }

    // 결과 메모는 주석 순서대로
    const order = new Map(comments.map((c, i) => [c.id, i]));
    edits.sort((a, b) => (order.get(a.commentId) ?? 0) - (order.get(b.commentId) ?? 0));
    return { content: { ...content, body: lines.join("\n") }, edits };
  }
}
