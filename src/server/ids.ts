import "server-only";
import { randomBytes } from "node:crypto";

/** 화면에서 만든 id도 이 규칙만 받는다 */
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** 짧고 정렬되는 id (시간 + 무작위) */
export function newId(prefix = "") {
  return `${prefix}${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
}
