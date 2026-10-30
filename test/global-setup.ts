import { MySqlContainer, type StartedMySqlContainer } from "@testcontainers/mysql";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

let container: StartedMySqlContainer | undefined;

/** 운영(OCI MySQL.Free)과 같은 버전의 격리 MySQL을 띄우고 마이그레이션까지 적용 */
export async function setup(project: TestProject) {
  container = await new MySqlContainer("mysql:26.10.0").withDatabase("newb_test").start();
  const url = container.getConnectionUri();
  const conn = await mysql.createConnection({ uri: url, multipleStatements: true });
  await migrate(drizzle({ client: conn }), { migrationsFolder: "drizzle" });
  await conn.end();
  project.provide("databaseUrl", url);
}

export async function teardown() {
  await container?.stop();
}
