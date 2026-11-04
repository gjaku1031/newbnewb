import { oauthConfig, SCOPE } from "@/server/services/oauth";

/** 보호 리소스 메타데이터 (RFC 9728) — MCP 클라이언트가 401을 받으면 여기서 인가 서버를 찾는다 */
export function GET() {
  const { issuer, resource } = oauthConfig();
  return Response.json(
    {
      resource,
      authorization_servers: [issuer],
      scopes_supported: [SCOPE],
      bearer_methods_supported: ["header"],
      resource_name: "newb",
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
