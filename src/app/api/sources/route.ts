import { after, connection } from "next/server";
import { withUser } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { createSource, MAX_UPLOAD_BYTES, SourceError } from "@/server/services/sources";
import { SourceTypeInput } from "@/server/validation";
import { organizeSource } from "@/server/services/sourceWiki";

/** 원본 문서 올리기 (multipart: files[], type) — 서버 액션 크기 한도(1MB)를 피해 Route Handler로 받는다 */
export async function POST(request: Request) {
  await connection();
  return withUser(request, async () => {
    // 본문을 메모리에 다 읽기 전에 크기부터 거른다
    const length = Number(request.headers.get("content-length"));
    if (!Number.isFinite(length) || length <= 0) return Response.json({ error: "파일이 필요해요" }, { status: 411 });
    if (length > MAX_UPLOAD_BYTES) return Response.json({ error: "한 번에 100MB까지 올릴 수 있어요" }, { status: 413 });

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return Response.json({ error: "multipart/form-data 형식이 아니에요" }, { status: 400 });
    }
    const type = SourceTypeInput.safeParse(form.get("type"));
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!type.success || files.length === 0 || files.length > 20) {
      return Response.json({ error: "파일과 자료 종류가 필요해요" }, { status: 400 });
    }
    const db = getDb();
    const ids: string[] = [];
    try {
      for (const f of files) {
        ids.push(await createSource(db, { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }, type.data));
      }
    } catch (error) {
      if (error instanceof SourceError) return Response.json({ error: error.message, ids }, { status: 400 });
      throw error;
    } finally {
      // 응답 뒤 Claude가 하나씩 위키로 정리 (앞 원본이 만든 페이지를 뒤 원본이 고칠 수 있게 차례로)
      if (ids.length)
        after(async () => {
          for (const id of ids) {
            try {
              await organizeSource(db, id);
            } catch (error) {
              console.error("[source-wiki] 정리 실패", id, error);
            }
          }
        });
    }
    return Response.json({ ids }, { status: 201 });
  });
}
