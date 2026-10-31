import { connection } from "next/server";
import { withUser } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { readSourceFile } from "@/server/services/sources";
import { Id } from "@/server/validation";

/** 원본 파일 내려받기 (로그인 필요) */
export async function GET(request: Request, ctx: RouteContext<"/api/sources/[id]/file">) {
  await connection();
  return withUser(request, async () => {
    const id = Id.safeParse((await ctx.params).id);
    const file = id.success ? await readSourceFile(getDb(), id.data) : undefined;
    if (!file) return Response.json({ error: "파일이 없어요" }, { status: 404 });
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  });
}
