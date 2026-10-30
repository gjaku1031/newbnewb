import { getCurrentUser } from "@/lib/auth";

/**
 * Agentation 주석 프록시.
 * 브라우저(어느 기기든) → 같은 주소의 /api/agentation/* → 로그인 확인 → 주석 서버(4747)
 * 주석 서버 포트를 외부에 열지 않고, 로그인한 사용자만 주석을 보낼 수 있게 한다.
 *
 * AGENTATION_URL: 주석 서버 주소 (기본 http://localhost:4747)
 *   oci-prod 배포 시에는 Claude Code가 도는 개발 서버 쪽 주소(Tailscale)로 지정.
 */
const UPSTREAM = (process.env.AGENTATION_URL ?? "http://localhost:4747").replace(/\/$/, "");

// 클라이언트가 쓰는 경로만 허용: health, sessions..., annotations...
const ALLOWED = /^(health|sessions(\/[\w-]+(\/(annotations|events|pending))?)?|annotations\/[\w-]+(\/thread)?)$/;

async function proxy(request: Request, ctx: RouteContext<"/api/agentation/[...path]">) {
  const user = await getCurrentUser(request);
  if (!user) return Response.json({ error: "로그인이 필요해요" }, { status: 401 });

  const { path } = await ctx.params;
  const subpath = path.join("/");
  if (!ALLOWED.test(subpath)) return Response.json({ error: "허용되지 않은 경로" }, { status: 404 });

  const search = new URL(request.url).search;
  const headers = new Headers();
  for (const name of ["content-type", "accept", "last-event-id"]) {
    const v = request.headers.get(name);
    if (v) headers.set(name, v);
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(`${UPSTREAM}/${subpath}${search}`, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      signal: request.signal,
      cache: "no-store",
    });
  } catch {
    return Response.json({ error: "주석 서버에 연결할 수 없어요" }, { status: 502 });
  }

  // 실시간 이벤트(SSE)는 스트림 그대로 전달
  const out = new Headers();
  const type = upstream.headers.get("content-type");
  if (type) out.set("content-type", type);
  out.set("cache-control", "no-store");
  if (type?.includes("text/event-stream")) out.set("x-accel-buffering", "no");

  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
