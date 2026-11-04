import { describe, expect, it } from "vitest";
import { deflateSync, strToU8, zipSync } from "fflate";
import * as CFB from "cfb";
import { extractText } from "@/server/extract";

/** 형식마다 최소한의 실제 구조로 파일을 만들어 글자를 뽑아 본다 */

const zip = (files: Record<string, string>) => zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));

describe("원본 문서 글자 뽑기", () => {
  it("docx: 문단·탭·줄바꿈·표·특수문자", async () => {
    const doc = `<?xml version="1.0"?><w:document xmlns:w="w"><w:body>
      <w:p><w:r><w:t>법인카드 사용 규정</w:t></w:r></w:p>
      <w:p><w:r><w:t xml:space="preserve">1회 </w:t></w:r><w:r><w:t>50만원 초과 &amp; 사전 품의</w:t></w:r><w:r><w:tab/><w:t>필수</w:t><w:br/><w:t>둘째 줄</w:t></w:r></w:p>
      <w:tbl><w:tr><w:tc><w:p><w:r><w:t>항목</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>기한</w:t></w:r></w:p></w:tc></w:tr>
      <w:tr><w:tc><w:p><w:r><w:t>증빙</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>익월 3일</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
    </w:body></w:document>`;
    const text = await extractText("docx", zip({ "word/document.xml": doc }));
    expect(text).toContain("법인카드 사용 규정");
    expect(text).toContain("1회 50만원 초과 & 사전 품의\t필수\n둘째 줄");
    expect(text).toContain("항목 | 기한\n증빙 | 익월 3일");
  });

  it("xlsx: 시트 이름 순서대로, 공유 문자열·숫자·인라인 문자열", async () => {
    const file = zip({
      "xl/workbook.xml": `<workbook><sheets><sheet name="경비" sheetId="1" r:id="rId1"/><sheet name="빈 시트" sheetId="2" r:id="rId2"/></sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>`,
      "xl/sharedStrings.xml": `<sst><si><t>계정과목</t></si><si><r><t>금</t></r><r><t>액</t></r></si><si><t>접대비</t></si></sst>`,
      "xl/worksheets/sheet1.xml": `<worksheet><sheetData>
        <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
        <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>100000</v></c><c r="C2" t="inlineStr"><is><t>팀장 승인</t></is></c></row>
      </sheetData></worksheet>`,
      "xl/worksheets/sheet2.xml": `<worksheet><sheetData/></worksheet>`,
    });
    expect(await extractText("xlsx", file)).toBe("## 경비\n계정과목 | 금액\n접대비 | 100000 | 팀장 승인");
  });

  it("pptx: 슬라이드 번호 순서대로", async () => {
    const slide = (t: string) => `<p:sld><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:sld>`;
    const file = zip({ "ppt/slides/slide10.xml": slide("열 번째"), "ppt/slides/slide2.xml": slide("두 번째"), "ppt/slides/slide1.xml": slide("첫 번째") });
    expect(await extractText("pptx", file)).toBe("## 슬라이드 1\n첫 번째\n\n## 슬라이드 2\n두 번째\n\n## 슬라이드 3\n열 번째");
  });

  it("hwpx: 구역·문단·표", async () => {
    const file = zip({
      "Contents/section0.xml": `<hs:sec><hp:p><hp:run><hp:t>주간보고 양식</hp:t></hp:run></hp:p>
        <hp:p><hp:run><hp:tbl><hp:tr><hp:tc><hp:subList><hp:p><hp:run><hp:t>마감</hp:t></hp:run></hp:p></hp:subList></hp:tc><hp:tc><hp:subList><hp:p><hp:run><hp:t>금 17:00</hp:t></hp:run></hp:p></hp:subList></hp:tc></hp:tr></hp:tbl></hp:run></hp:p></hs:sec>`,
      "Contents/section1.xml": `<hs:sec><hp:p><hp:run><hp:t>둘째 구역</hp:t><hp:lineBreak/><hp:t>다음 줄</hp:t></hp:run></hp:p></hs:sec>`,
    });
    const text = await extractText("hwpx", file);
    expect(text).toContain("주간보고 양식");
    expect(text).toContain("마감 | 금 17:00");
    expect(text).toContain("둘째 구역\n다음 줄");
  });

  it("hwp(5.x): 압축된 본문 레코드에서 문단 글자만, 표·그림 같은 제어 문자는 건너뛴다", async () => {
    const record = (tag: number, payload: Buffer) => {
      const h = Buffer.alloc(4);
      h.writeUInt32LE((tag & 0x3ff) | (payload.length << 20));
      return Buffer.concat([h, payload]);
    };
    const utf16 = (s: string) => Buffer.from(s, "utf16le");
    const ctrl = (code: number) => Buffer.concat([Buffer.from([code, 0]), Buffer.alloc(14)]); // 8글자짜리 제어
    const section = Buffer.concat([
      record(66, Buffer.alloc(8)), // 문단 머리 (무시)
      record(67, Buffer.concat([utf16("접대비 1인당"), ctrl(11), utf16(" 10만원"), ctrl(9), utf16("초과 시 승인"), Buffer.from([13, 0])])),
      record(67, Buffer.concat([utf16("둘째 문단"), Buffer.from([13, 0])])),
    ]);
    const header = Buffer.alloc(256);
    header.write("HWP Document File", 0, "latin1");
    header.writeUInt32LE(1, 36); // 압축됨
    const doc = CFB.utils.cfb_new();
    CFB.utils.cfb_add(doc, "/FileHeader", header);
    CFB.utils.cfb_add(doc, "/BodyText/Section0", Buffer.from(deflateSync(section)));
    const bytes = new Uint8Array(CFB.write(doc, { type: "buffer" }) as Buffer);
    expect(await extractText("hwp", bytes)).toBe("접대비 1인당 10만원\t초과 시 승인\n둘째 문단");
  });

  it("배포용·암호 hwp, 깨진 파일, PDF·이미지는 null", async () => {
    const header = Buffer.alloc(256);
    header.write("HWP Document File", 0, "latin1");
    header.writeUInt32LE(1 | 4, 36); // 배포용
    const doc = CFB.utils.cfb_new();
    CFB.utils.cfb_add(doc, "/FileHeader", header);
    expect(await extractText("hwp", new Uint8Array(CFB.write(doc, { type: "buffer" }) as Buffer))).toBeNull();
    expect(await extractText("docx", new Uint8Array([1, 2, 3]))).toBeNull();
    expect(await extractText("pdf", new Uint8Array([1]))).toBeNull();
    expect(await extractText("image", new Uint8Array([1]))).toBeNull();
    expect(await extractText("text", strToU8("  메모  \n\n\n\n둘째\n"))).toBe("메모\n\n둘째");
  });
});
