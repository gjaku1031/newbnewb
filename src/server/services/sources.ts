import "server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Source, SourceType } from "@/lib/types";
import { seoulToday } from "@/lib/today";
import { sources } from "@/server/db/schema";
import type { Exec } from "@/server/db/types";
import { newId } from "@/server/ids";
import { deleteObject, getObjectBytes, putObject } from "@/server/storage";

/** 올릴 수 있는 파일 — 확장자로 종류를 정한다 */
const FILE_TYPES: Record<string, Source["fileType"]> = {
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
  pptx: "pptx",
  hwp: "hwp",
  hwpx: "hwpx",
  txt: "text",
  md: "text",
  png: "image",
  jpg: "image",
  jpeg: "image",
};

export const MAX_SOURCE_BYTES = 30 * 1024 * 1024;

export class SourceError extends Error {}

export function fileTypeOf(name: string): Source["fileType"] | undefined {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return FILE_TYPES[ext];
}

/** 원본 파일을 Object Storage에 올리고 메타데이터를 저장 */
export async function createSource(db: Exec, file: { name: string; type: string; bytes: Uint8Array }, type: SourceType) {
  const fileType = fileTypeOf(file.name);
  if (!fileType) throw new SourceError(`지원하지 않는 파일 형식: ${file.name}`);
  if (file.bytes.byteLength > MAX_SOURCE_BYTES) throw new SourceError(`파일이 너무 커요 (최대 30MB): ${file.name}`);

  const id = newId("s");
  const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-120);
  const objectKey = `sources/${id}/${safeName}`;
  const contentType = file.type || "application/octet-stream";
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
  const ext = s.objectKey.split(".").pop();
  return { bytes, contentType: s.contentType ?? "application/octet-stream", filename: `${s.title}.${ext}` };
}
