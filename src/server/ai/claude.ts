import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

/**
 * Claude API 공통 호출.
 * 메모 정리·위키 주석 반영·모순 검토는 Claude로만 한다. ANTHROPIC_API_KEY가 없으면 처리하지 않고 ClaudeUnavailableError.
 */
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

export const claudeEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client: Anthropic | undefined;
const getClient = () => (client ??= new Anthropic({ timeout: 300_000, maxRetries: 2 }));

export class ClaudeError extends Error {}

/** API 키가 없어 Claude를 부를 수 없음 — 화면에 그대로 보여줄 수 있는 문구 */
export class ClaudeUnavailableError extends ClaudeError {
  constructor() {
    super("Claude API 키가 없어 처리하지 못했어요. 설정 → Claude API를 확인해 주세요.");
  }
}

type Effort = "low" | "medium" | "high";

/**
 * 구조화 출력(JSON 스키마)으로 한 번 묻고 검증된 결과를 돌려준다.
 * 거절·토큰 초과·형식 오류는 ClaudeError — 호출한 쪽이 '실패'로 남기고 사용자가 다시 시도한다.
 */
export async function askClaude<S extends z.ZodType>(opts: {
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[] | string;
  schema: S;
  effort: Effort;
  maxTokens?: number;
}): Promise<z.infer<S>> {
  if (!claudeEnabled()) throw new ClaudeUnavailableError();
  const res = await getClient().beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 16_000,
    system: opts.system,
    messages: [{ role: "user", content: opts.content }],
    output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
    // 안전 분류기가 거절하면 서버가 알맞은 모델로 다시 실행한다
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  if (res.stop_reason === "refusal") throw new ClaudeError(`Claude가 처리를 거절했어요 (${res.stop_details?.category ?? "이유 없음"})`);
  if (res.stop_reason === "max_tokens") throw new ClaudeError("Claude 응답이 너무 길어 잘렸어요");
  if (res.parsed_output == null) throw new ClaudeError("Claude 응답 형식이 맞지 않아요");
  return res.parsed_output as z.infer<S>;
}

/** 프롬프트 안에서 데이터 블록을 구분하는 태그 (사용자 글이 지시처럼 읽히지 않게) */
export const tag = (name: string, body: string, attrs: Record<string, string | number | undefined> = {}) => {
  const a = Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => ` ${k}="${String(v).replace(/"/g, "&quot;")}"`)
    .join("");
  return `<${name}${a}>\n${body}\n</${name}>`;
};
