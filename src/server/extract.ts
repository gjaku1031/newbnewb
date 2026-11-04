import "server-only";
import { inflateSync, strFromU8, unzipSync, type Unzipped } from "fflate";
import * as CFB from "cfb";
import type { Source } from "@/lib/types";

/**
 * 원본 문서에서 글자 뽑기 — 위키 정리·모순 검토·검색이 원본 내용을 읽을 수 있게.
 * docx·xlsx·pptx·hwpx는 zip 안의 XML, hwp(한글 97 이후 5.x)는 OLE 복합 파일 안의 압축된 레코드.
 * PDF·이미지는 Claude가 직접 읽으므로 여기서 뽑지 않는다 (null).
 * 읽지 못하면(암호·배포용 문서, 깨진 파일) null.
 */

/** DB에 저장하는 글자 수 한도 (MEDIUMTEXT 안, Claude에 넘기기에도 충분) */
export const MAX_TEXT_CHARS = 300_000;

export async function extractText(fileType: Source["fileType"], bytes: Uint8Array): Promise<string | null> {
  try {
    const text = extractRaw(fileType, bytes);
    if (text == null) return null;
    const tidy = text
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return tidy ? tidy.slice(0, MAX_TEXT_CHARS) : null;
  } catch (error) {
    console.warn("[extract] 글자를 뽑지 못함", fileType, error instanceof Error ? error.message : error);
    return null;
  }
}

function extractRaw(fileType: Source["fileType"], bytes: Uint8Array): string | null {
  switch (fileType) {
    case "text":
      return new TextDecoder("utf-8").decode(bytes);
    case "docx":
      return docx(unzipSync(bytes));
    case "xlsx":
      return xlsx(unzipSync(bytes));
    case "pptx":
      return pptx(unzipSync(bytes));
    case "hwpx":
      return hwpx(unzipSync(bytes));
    case "hwp":
      return hwp(bytes);
    default:
      return null;
  }
}

/* ───────── XML 공통 ───────── */

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");

const file = (zip: Unzipped, path: string) => (zip[path] ? strFromU8(zip[path]) : "");

/** 이름 끝 숫자 순서로 (slide2 < slide10) */
const byNumber = (a: string, b: string) => Number(a.match(/(\d+)\D*$/)?.[1] ?? 0) - Number(b.match(/(\d+)\D*$/)?.[1] ?? 0);

/** 한 문단(<p>…</p>) 안의 글자: <t>…</t>를 잇는다. 탭·줄바꿈 표시는 글자로 바꿔 순서대로 넣는다 */
function runs(xml: string, t: string, tab: RegExp, br: RegExp) {
  return decodeXml(
    xml
      .replace(tab, `<${t}>\t</${t}>`)
      .replace(br, `<${t}>\n</${t}>`)
      .replace(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, "g"), "\u0000$1\u0000")
      .split("\u0000")
      .filter((_, i) => i % 2 === 1)
      .join(""),
  );
}

/* ───────── Word (docx) ───────── */

function docx(zip: Unzipped) {
  const xml = file(zip, "word/document.xml");
  if (!xml) return null;
  // 표: 칸 끝·줄 끝을 표시 글자로 넣어 두었다가 " | "·줄바꿈으로
  const body = xml.replace(/<\/w:tc>/g, "<w:t>\u0001</w:t></w:tc>").replace(/<\/w:tr>/g, "<w:t>\u0002</w:t></w:tr>");
  return body
    .split(/<\/w:p>/)
    .map((p) => runs(p, "w:t", /<w:tab\/>/g, /<w:(?:br|cr)\/>/g))
    .join("\n")
    .replace(/\n*\u0001\n*/g, " | ")
    .replace(/( \| )?\u0002\n*/g, "\n");
}

/* ───────── PowerPoint (pptx) ───────── */

function pptx(zip: Unzipped) {
  const slides = Object.keys(zip)
    .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
    .sort(byNumber);
  if (slides.length === 0) return null;
  return slides
    .map((k, i) => {
      const paras = file(zip, k)
        .split(/<\/a:p>/)
        .map((p) => runs(p, "a:t", /<a:tab\/>/g, /<a:br\/>/g).trim())
        .filter(Boolean);
      return `## 슬라이드 ${i + 1}\n${paras.join("\n")}`;
    })
    .join("\n\n");
}

/* ───────── 한글 (hwpx: zip + XML) ───────── */

function hwpx(zip: Unzipped) {
  const sections = Object.keys(zip)
    .filter((k) => /^Contents\/section\d+\.xml$/i.test(k))
    .sort(byNumber);
  if (sections.length === 0) return null;
  return sections
    .map((k) =>
      file(zip, k)
        .replace(/<\/hp:tc>/g, "<hp:t>\u0001</hp:t></hp:tc>")
        .replace(/<\/hp:tr>/g, "<hp:t>\u0002</hp:t></hp:tr>")
        .split(/<\/hp:p>/)
        .map((p) => runs(p, "hp:t", /<hp:tab[^>]*\/>/g, /<hp:lineBreak[^>]*\/>/g))
        .join("\n")
        .replace(/\n*\u0001\n*/g, " | ")
        .replace(/( \| )?\u0002\n*/g, "\n"),
    )
    .join("\n\n");
}

/* ───────── Excel (xlsx) ───────── */

function xlsx(zip: Unzipped) {
  const shared = file(zip, "xl/sharedStrings.xml")
    .split(/<\/si>/)
    .slice(0, -1)
    .map((si) => runs(si, "t", /$^/g, /$^/g));
  const rels = new Map(
    [...file(zip, "xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)].map((m) => [
      m[0].match(/Id="([^"]+)"/)?.[1],
      m[0].match(/Target="([^"]+)"/)?.[1],
    ]),
  );
  const sheets = [...file(zip, "xl/workbook.xml").matchAll(/<sheet\b[^>]*>/g)].map((m) => ({
    name: decodeXml(m[0].match(/name="([^"]*)"/)?.[1] ?? "시트"),
    target: rels.get(m[0].match(/r:id="([^"]+)"/)?.[1]),
  }));
  if (sheets.length === 0) return null;

  return sheets
    .map(({ name, target }) => {
      if (!target) return "";
      const path = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
      const rows = [...file(zip, path).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)]
        .map((row) =>
          [...row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)]
            .map(([, attrs, inner = ""]) => {
              const type = attrs.match(/\bt="([^"]+)"/)?.[1];
              if (type === "inlineStr") return runs(inner, "t", /$^/g, /$^/g);
              const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
              if (v == null) return "";
              if (type === "s") return shared[Number(v)] ?? "";
              if (type === "b") return v === "1" ? "TRUE" : "FALSE";
              return decodeXml(v);
            })
            .join(" | ")
            .replace(/( \| )+$/, ""),
        )
        .filter((r) => r.replace(/[\s|]/g, ""));
      return rows.length ? `## ${name}\n${rows.join("\n")}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

/* ───────── 한글 (hwp 5.x: OLE 복합 파일) ───────── */

/** 레코드 태그: HWPTAG_BEGIN(16) + 51 = 문단 글자 */
const HWPTAG_PARA_TEXT = 67;

function hwp(bytes: Uint8Array) {
  const cfb = CFB.read(Buffer.from(bytes), { type: "buffer" });
  const header = CFB.find(cfb, "FileHeader")?.content;
  if (!header) return null;
  const head = Buffer.from(header as Uint8Array);
  if (!head.subarray(0, 17).toString("latin1").startsWith("HWP Document File")) return null;
  const props = head.readUInt32LE(36);
  const compressed = (props & 1) !== 0;
  const encrypted = (props & 2) !== 0;
  const distribution = (props & 4) !== 0;
  // 암호를 걸었거나 배포용(복사 방지) 문서는 읽지 않는다
  if (encrypted || distribution) return null;

  const sections = cfb.FullPaths.map((p, i) => ({ p, e: cfb.FileIndex[i] }))
    .filter(({ p }) => /\/BodyText\/Section\d+$/.test(p))
    .sort((a, b) => byNumber(a.p, b.p));
  const out: string[] = [];
  for (const { e } of sections) {
    let data = Buffer.from(e.content as Uint8Array);
    if (compressed) data = Buffer.from(inflateSync(data));
    out.push(paraTexts(data).join("\n"));
  }
  return out.join("\n\n");
}

/** 섹션 스트림의 레코드를 따라가며 문단 글자(UTF-16LE)만 꺼낸다 */
function paraTexts(data: Buffer) {
  const paras: string[] = [];
  let pos = 0;
  while (pos + 4 <= data.length) {
    const h = data.readUInt32LE(pos);
    pos += 4;
    const tag = h & 0x3ff;
    let size = (h >>> 20) & 0xfff;
    if (size === 0xfff) {
      size = data.readUInt32LE(pos);
      pos += 4;
    }
    if (tag === HWPTAG_PARA_TEXT) paras.push(paraText(data.subarray(pos, pos + size)));
    pos += size;
  }
  return paras;
}

/**
 * 문단 글자: 0~31은 제어 문자. 표·그림 같은 확장/인라인 제어는 8글자(16바이트)를 차지하고 건너뛴다.
 * 9 = 탭, 10 = 줄바꿈, 13 = 문단 끝, 24~31·0은 한 글자짜리 표시.
 */
const EIGHT_WIDE = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);

function paraText(buf: Buffer) {
  let s = "";
  for (let i = 0; i + 1 < buf.length; ) {
    const c = buf.readUInt16LE(i);
    if (c < 32) {
      if (c === 9) s += "\t";
      else if (c === 10) s += "\n";
      i += EIGHT_WIDE.has(c) ? 16 : 2;
      continue;
    }
    s += String.fromCharCode(c);
    i += 2;
  }
  return s;
}
