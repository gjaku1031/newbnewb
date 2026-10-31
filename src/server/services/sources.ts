import "server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Source, SourceType } from "@/lib/types";
import { seoulToday } from "@/lib/today";
import { sources } from "@/server/db/schema";
import type { Exec } from "@/server/db/types";
import { newId } from "@/server/ids";
import { deleteObject, getObjectBytes, putObject } from "@/server/storage";

/**
 * 올릴 수 있는 파일 — 종류와 내려줄 Content-Type을 확장자로 정한다.
 * 브라우저가 보낸 Content-Type은 믿지 않는다 (text/html로 올린 .png가 HTML로 열리지 않게).
 */
const FILE_TYPES: Record<string, { fileType: Source["fileType"]; contentType: string }> = {
  pdf: { fileType: "pdf", contentType: "application/pdf" },
  docx: { fileType: "docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  xlsx: { fileType: "xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  pptx: { fileType: "pptx", contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
  hwp: { fileType: "hwp", contentType: "application/x-hwp" },
  hwpx: { fileType: "hwpx", contentType: "application/hwp+zip" },
  txt: { fileType: "text", contentType: "text/plain; charset=utf-8" },
  md: { fileType: "text", contentType: "text/markdown; charset=utf-8" },
  png: { fileType: "image", contentType: "image/png" },
  jpg: { fileType: "image", contentType: "image/jpeg" },
  jpeg: { fileType: "image", contentType: "image/jpeg" },
};

export const MAX_SOURCE_BYTES = 30 * 1024 * 1024;
/** 한 번에 올리는 요청 전체 한도 — 본문을 메모리에 읽기 전에 Content-Length로 거른다 */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export class SourceError extends Error {}

const extOf = (name: string) => (name.includes(".") ? name.toLowerCase().split(".").pop()! : "");

export function fileTypeOf(name: string): Source["fileType"] | undefined {
  return FILE_TYPES[extOf(name)]?.fileType;
}

/** 원본 파일을 Object Storage에 올리고 메타데이터를 저장 */
export async function createSource(db: Exec, file: { name: string; bytes: Uint8Array }, type: SourceType) {
  const known = FILE_TYPES[extOf(file.name)];
  if (!known) throw new SourceError(`지원하지 않는 파일 형식: ${file.name}`);
  const { fileType, contentType } = known;
  if (file.bytes.byteLength > MAX_SOURCE_BYTES) throw new SourceError(`파일이 너무 커요 (최대 30MB): ${file.name}`);

  const id = newId("s");
  const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-120);
  const objectKey = `sources/${id}/${safeName}`;
  await putObject(objectKey, file.bytes, contentType);
  try {
    await db.insert(sources).values({
      id,
      title: file.name.replace(/\.[^.]+$/, "").slice(0, 255),
      type,
      fileType,
      addedOn: seoulToday(),
      objectKey,
      contentType,
      sizeBytes: file.bytes.byteLength,
      sha256: createHash("sha256").update(file.bytes).digest("hex"),
    });
  } catch (error) {
    // DB에 못 쓰면 올린 파일도 지운다
    await deleteObject(objectKey).catch(() => undefined);
    throw error;
  }
  return id;
}

export async function readSourceFile(db: Exec, id: string) {
  const [s] = await db.select().from(sources).where(eq(sources.id, id));
  if (!s?.objectKey) return undefined;
  const bytes = await getObjectBytes(s.objectKey);
  const ext = extOf(s.objectKey);
  // 예전에 저장된 값도 확장자 기준으로 다시 정한다
  const contentType = FILE_TYPES[ext]?.contentType ?? "application/octet-stream";
  return { bytes, contentType, filename: ext ? `${s.title}.${ext}` : s.title };
}
