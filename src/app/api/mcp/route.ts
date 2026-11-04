import { connection } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getDb } from "@/server/db/client";
import { createMcpServer } from "@/server/mcp/server";
import { oauthConfig, verifyAccessToken } from "@/server/services/oauth";

/**
 * MCP 엔드포인트 (Streamable HTTP, 상태 없음). Claude Desktop 커스텀 커넥터가 OAuth 토큰을 붙여 부른다.
 * 토큰이 없거나 틀리면 401 + 보호 리소스 메타데이터 주소 → Claude가 OAuth를 시작한다.
 */
function unauthorized(error?: "invalid_token") {
  const { issuer } = oauthConfig();
  const params = [`resource_metadata="${issuer}/.well-known/oauth-protected-resource/api/mcp"`, 'scope="newb"'];
  if (error) params.push(`error="${error}"`);
  return Response.json(
    { error: error ?? "unauthorized", error_description: "newb 로그인이 필요해요" },
    { status: 401, headers: { "WWW-Authenticate": `Bearer ${params.join(", ")}` } },
  );
}

export async function POST(request: Request) {
  await connection();
  // 브라우저에서 온 요청이면 출처를 확인한다 (DNS 리바인딩 방지). Claude 서버 요청엔 Origin이 없다
  const origin = request.headers.get("origin");
  if (origin && origin !== oauthConfig().issuer) return Response.json({ error: "forbidden origin" }, { status: 403 });

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return unauthorized();
  const db = getDb();
  const auth = await verifyAccessToken(db, oauthConfig(), bearer);
  if (!auth) return unauthorized("invalid_token");

  const server = createMcpServer(db);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request, {
      authInfo: { token: bearer, clientId: auth.clientId, scopes: [auth.scope] },
    });
  } finally {
    // 응답을 다 만든 뒤 정리 (JSON 응답이라 스트림을 열어 두지 않음)
    void transport.close().catch(() => undefined);
    void server.close().catch(() => undefined);
  }
}

/** 상태 없는 서버라 서버→클라이언트 스트림(GET)·세션 종료(DELETE)는 없다 */
const notAllowed = () => new Response(null, { status: 405, headers: { Allow: "POST" } });
export const GET = notAllowed;
export const DELETE = notAllowed;
