import { connection } from "next/server";
import { withUser } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { exportWikiZip } from "@/server/services/wikiExport";

/** 위키 전체를 마크다운 zip으로 내려받기 */
export async function GET(request: Request) {
  await connection();
  return withUser(request, async () => {
    const { bytes, filename } = await exportWikiZip(getDb());
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="newb-wiki.zip"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  });
}
