import "server-only";
import { Readable } from "node:stream";
import * as common from "oci-common";
import { ObjectStorageClient } from "oci-objectstorage";
import type { ObjectStore } from "./storage";

/**
 * OCI Object Storage (공식 SDK).
 * 운영은 서버 인증(Instance Principal): oci-prod 인스턴스만 들어 있는 동적 그룹에 newb-files 버킷 권한만 줬다.
 */
export async function createOciStore(env: Record<string, string | undefined>): Promise<ObjectStore> {
  const { OCI_AUTH: auth, OCI_REGION: region, OCI_NAMESPACE: namespaceName, OCI_BUCKET: bucketName } = env;
  if (!region || !namespaceName || !bucketName) throw new Error("OCI_REGION·OCI_NAMESPACE·OCI_BUCKET이 필요해요");

  let provider: common.AuthenticationDetailsProvider;
  if (auth === "instance_principal") {
    provider = await new common.InstancePrincipalsAuthenticationDetailsProviderBuilder().build();
  } else if (auth === "config_file") {
    provider = new common.ConfigFileAuthenticationDetailsProvider(env.OCI_CONFIG_FILE, env.OCI_PROFILE);
  } else {
    throw new Error(`OCI_AUTH 값을 알 수 없어요: ${auth} (instance_principal | config_file)`);
  }

  const client = new ObjectStorageClient({ authenticationDetailsProvider: provider });
  client.regionId = region;
  const base = { namespaceName, bucketName };

  return {
    kind: "oci",
    async check() {
      await client.headBucket(base);
    },
    async put(key, body, contentType) {
      await client.putObject({
        ...base,
        objectName: key,
        putObjectBody: Buffer.from(body),
        contentLength: body.byteLength,
        contentType,
      });
    },
    async get(key) {
      const res = await client.getObject({ ...base, objectName: key });
      return toBytes(res.value);
    },
    async delete(key) {
      await client.deleteObject({ ...base, objectName: key });
    },
  };
}

/** SDK가 돌려주는 본문(Node 스트림 또는 Web 스트림) → 바이트 */
async function toBytes(value: Readable | ReadableStream): Promise<Uint8Array> {
  const stream = value instanceof Readable ? value : Readable.fromWeb(value as import("node:stream/web").ReadableStream);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return new Uint8Array(Buffer.concat(chunks));
}
