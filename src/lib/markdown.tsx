import Link from "next/link";
import { Fragment } from "react";
import { getWikiPage } from "@/mocks/wiki";

/**
 * 위키 본문용 아주 작은 마크다운 렌더러.
 * 지원: ## 제목, - 목록, 1. 목록, > 인용, **굵게**, `코드`, [[위키링크]]
 * 실제 서비스에선 remark 등으로 교체 예정.
 */

/** ## 제목 앵커 id (본문 렌더와 '이 페이지에서' 목차가 같은 규칙을 쓴다) */
const headingId = (n: number) => `sec-${n}`;

/** 목차용: 본문의 ## 제목 목록 */
export function extractHeadings(source: string): { id: string; text: string }[] {
  return source
    .split("\n")
    .filter((l) => l.startsWith("## "))
    .map((l, n) => ({ id: headingId(n), text: plainText(l.slice(3)) }));
}

/** 마크다운 기호를 걷어낸 글자만 (목차 표시용) */
function plainText(text: string) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, (_, slug: string) => getWikiPage(slug)?.title ?? slug);
}

function inline(text: string, keyBase: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[\[[^\]]+\]\])/g);
  return parts.map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={key}>{part.slice(1, -1)}</code>;
    if (part.startsWith("[[") && part.endsWith("]]")) {
      const slug = part.slice(2, -2);
      const page = getWikiPage(slug);
      // 아직 없는 페이지는 링크 없이 흐리게
      if (!page)
        return (
          <span key={key} className="text-faint" title="아직 없는 페이지">
            {slug}
          </span>
        );
      return (
        <Link key={key} href={`/wiki/${slug}`}>
          {page.title}
        </Link>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const lines = source.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let h = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={i} id={headingId(h++)} className="scroll-mt-6">
          {inline(line.slice(3), `h${i}`)}
        </h2>,
      );
      i++;
      continue;
    }
    if (line.startsWith("> ")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) buf.push(lines[i++].slice(2));
      blocks.push(<blockquote key={`q${i}`}>{inline(buf.join(" "), `q${i}`)}</blockquote>);
      continue;
    }
    if (/^- /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^- /.test(lines[i])) items.push(lines[i++].slice(2));
      blocks.push(
        <ul key={`u${i}`}>
          {items.map((t, k) => (
            <li key={k}>{inline(t, `u${i}-${k}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) items.push(lines[i++].replace(/^\d+\. /, ""));
      blocks.push(
        <ol key={`o${i}`}>
          {items.map((t, k) => (
            <li key={k}>{inline(t, `o${i}-${k}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }
    blocks.push(<p key={i}>{inline(line, `p${i}`)}</p>);
    i++;
  }
  return <div className={className ?? "prose-wiki"}>{blocks}</div>;
}
