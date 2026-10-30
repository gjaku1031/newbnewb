import { connection } from "next/server";
import { requireUser, UnauthorizedError } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { createSource, SourceError } from "@/server/services/sources";
import { SourceTypeInput } from "@/server/validation";

/** 원본 문서 올리기 (multipart: files[], type) — 서버 액션 크기 한도(1MB)를 피해 Route Handler로 받는다 */
export async function POST(request: Request) {
  await connection();
  try {
    await requireUser(request);
  } catch (error) {
    if (error instanceof UnauthorizedError) return Response.json({ error: error.message }, { status: 401 });
    throw error;
  }
  const form = await request.formData();
  const type = SourceTypeInput.safeParse(form.get("type"));
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!type.success || files.length === 0 || files.length > 20) {
    return Response.json({ error: "파일과 자료 종류가 필요해요" }, { status: 400 });
  }
  const db = getDb();
  const ids: string[] = [];
  try {
    for (const f of files) {
      ids.push(await createSource(db, { name: f.name, type: f.type, bytes: new Uint8Array(await f.arrayBuffer()) }, type.data));
    }
  } catch (error) {
    if (error instanceof SourceError) return Response.json({ error: error.message, ids }, { status: 400 });
    throw error;
  }
  return Response.json({ ids }, { status: 201 });
}
