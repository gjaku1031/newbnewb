"use client";

import Link from "next/link";
import { Fragment } from "react";
import { headingId, type TitleOf } from "@/lib/markdownText";
import { useTitleOf } from "@/components/workspace/hooks";

export { extractHeadings } from "@/lib/markdownText";

/**
 * 위키 본문용 아주 작은 마크다운 렌더러.
 * 지원: ## 제목, - 목록, 1. 목록, > 인용, **굵게**, `코드`, [[위키링크]]
 * 실제 서비스에선 remark 등으로 교체 예정.
 */

function inline(text: string, keyBase: string, titleOf: TitleOf): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[\[[^\]]+\]\])/g);
  return parts.map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={key}>{part.slice(1, -1)}</code>;
    if (part.startsWith("[[") && part.endsWith("]]")) {
      const slug = part.slice(2, -2);
      const title = titleOf(slug);
      // 아직 없는 페이지는 링크 없이 흐리게
      if (!title)
        return (
          <span key={key} className="text-faint" title="아직 없는 페이지">
            {slug}
          </span>
        );
      return (
        <Link key={key} href={`/wiki/${slug}`}>
          {title}
        </Link>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const titleOf = useTitleOf();
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
        <h2 key={i} id={headingId(h++)} className="scroll-mt-6" data-line={i}>
          {inline(line.slice(3), `h${i}`, titleOf)}
        </h2>,
      );
      i++;
      continue;
    }
    if (line.startsWith("> ")) {
      const buf: string[] = [];
      const from = i;
      while (i < lines.length && lines[i].startsWith("> ")) buf.push(lines[i++].slice(2));
      blocks.push(
        <blockquote key={`q${i}`} data-line={from}>
          {inline(buf.join(" "), `q${i}`, titleOf)}
        </blockquote>,
      );
      continue;
    }
    if (/^- /.test(line)) {
      const items: string[] = [];
      const from = i;
      while (i < lines.length && /^- /.test(lines[i])) items.push(lines[i++].slice(2));
      blocks.push(
        <ul key={`u${i}`}>
          {items.map((t, k) => (
            <li key={k} data-line={from + k}>
              {inline(t, `u${i}-${k}`, titleOf)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      const from = i;
      while (i < lines.length && /^\d+\. /.test(lines[i])) items.push(lines[i++].replace(/^\d+\. /, ""));
      blocks.push(
        <ol key={`o${i}`}>
          {items.map((t, k) => (
            <li key={k} data-line={from + k}>
              {inline(t, `o${i}-${k}`, titleOf)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }
    blocks.push(
      <p key={i} data-line={i}>
        {inline(line, `p${i}`, titleOf)}
      </p>,
    );
    i++;
  }
  return <div className={className ?? "prose-wiki"}>{blocks}</div>;
}
