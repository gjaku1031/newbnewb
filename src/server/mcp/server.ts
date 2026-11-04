import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Db } from "@/server/db/types";
import { ClaudeUnavailableError } from "@/server/ai/claude";
import { addToWiki, askNewb, guidelines, taskBrief } from "./tools";

/** newb MCP 서버 — 요청마다 새로 만든다 (상태 없음) */
export function createMcpServer(db: Db) {
  const server = new McpServer(
    { name: "newb", version: "1.0.0" },
    {
      instructions:
        "newb는 신입사원의 업무 도우미예요. 회사 규칙·절차가 궁금하면 ask_newb, 할 일을 시작할 때는 get_task_brief로 지침을 먼저 받고, " +
        "새로 알게 된 회사 규칙은 add_to_wiki로 남기세요. 답할 때 newb 링크를 함께 알려 주세요.",
    },
  );

  const run = async (task: () => Promise<string>) => {
    try {
      return { content: [{ type: "text" as const, text: await task() }] };
    } catch (error) {
      console.error("[mcp] 도구 실패", error);
      const message = error instanceof ClaudeUnavailableError ? error.message : "newb에서 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.";
      return { isError: true, content: [{ type: "text" as const, text: message }] };
    }
  };

  server.registerTool(
    "ask_newb",
    {
      title: "newb에 물어보기",
      description:
        "회사 업무 질문(규정·절차·양식·담당 부서·기한 등)을 newb 위키·원본 문서·주의할 점을 근거로 답한다. " +
        "답할 수 있는지(근거 포함)와, 모자라면 누구에게 무엇을 물어볼지 알려 주고 질문 기록에 남긴다.",
      inputSchema: {
        question: z.string().min(2).max(2000).describe("물어볼 내용 (한국어 그대로)"),
        item_id: z.string().max(64).optional().describe("관련된 newb 할 일 id (있으면)"),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    ({ question, item_id }) => run(async () => (await askNewb(db, { question, item_id })).text),
  );

  server.registerTool(
    "get_task_brief",
    {
      title: "할 일 작업 지침",
      description:
        "newb 할 일의 작업 지침·하위 항목·관련 위키 전문·주의할 점을 준다. item_id 없이 부르면 아직 안 끝난 할 일 목록(id 포함)을 준다.",
      inputSchema: { item_id: z.string().max(64).optional().describe("newb 할 일 id") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ item_id }) => run(() => taskBrief(db, { item_id })),
  );

  server.registerTool(
    "get_guidelines",
    {
      title: "가이드라인 찾기",
      description: "newb 위키와 원본 문서에서 낱말로 찾아 관련 페이지 전문과 원본 발췌를 준다 (판단 없이 자료만).",
      inputSchema: { query: z.string().min(1).max(200).describe("찾을 낱말 (예: 법인카드 접대비)") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ query }) => run(() => guidelines(db, { query })),
  );

  server.registerTool(
    "add_to_wiki",
    {
      title: "위키에 추가",
      description:
        "새로 알게 된 회사 규칙·절차·사실을 newb 위키에 남긴다. 알맞은 페이지가 있으면 고치고(모순 검토 후 반영), 없으면 새 페이지를 만든다.",
      inputSchema: {
        title: z.string().min(1).max(200).describe("내용을 한 줄로 (예: 접대비 참석자 직급 기재)"),
        content: z.string().min(1).max(20000).describe("남길 내용 (누가 알려줬는지는 이름 대신 직책으로)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    ({ title, content }) => run(() => addToWiki(db, { title, content })),
  );

  return server;
}
