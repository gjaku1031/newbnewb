import { oauthConfig, SCOPE } from "@/server/services/oauth";

/** 인가 서버 메타데이터 (RFC 8414) */
export function GET() {
  const { issuer } = oauthConfig();
  return Response.json(
    {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/api/oauth/token`,
      registration_endpoint: `${issuer}/api/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: [SCOPE],
      authorization_response_iss_parameter_supported: true,
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
