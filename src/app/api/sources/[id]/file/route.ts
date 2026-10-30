import { connection } from "next/server";
import { requireUser, UnauthorizedError } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { readSourceFile } from "@/server/services/sources";

/** 원본 파일 내려받기 (로그인 필요) */
export async function GET(request: Request, ctx: RouteContext<"/api/sources/[id]/file">) {
  await connection();
  try {
    await requireUser(request);
  } catch (error) {
    if (error instanceof UnauthorizedError) return Response.json({ error: error.message }, { status: 401 });
    throw error;
  }
  const { id } = await ctx.params;
  const file = await readSourceFile(getDb(), id);
  if (!file) return Response.json({ error: "파일이 없어요" }, { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
