import "server-only";

/**
 * Object Storage — 환경에 따라 두 가지 방식 중 하나를 쓴다.
 *
 * 1) 운영(oci-prod): OCI SDK + 서버 인증(Instance Principal), 비밀키 없음
 *    OCI_AUTH=instance_principal  OCI_REGION  OCI_NAMESPACE  OCI_BUCKET
 *    (infra/oci/setup-object-storage.sh가 /srv/newb/object-storage.env로 만들어 둠)
 *    OCI_AUTH=config_file 이면 ~/.oci/config(OCI_CONFIG_FILE, OCI_PROFILE)로 인증 — oci-dev에서 확인할 때
 *
 * 2) 로컬: S3 호환 API (compose.yaml의 RustFS)
 *    S3_ENDPOINT  S3_REGION  S3_BUCKET  S3_ACCESS_KEY_ID  S3_SECRET_ACCESS_KEY
 */
export interface ObjectStore {
  readonly kind: "oci" | "s3";
  check(signal?: AbortSignal): Promise<void>;
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}

const cache = globalThis as unknown as { newbStore?: Promise<ObjectStore> };

function store(): Promise<ObjectStore> {
  return (cache.newbStore ??= createStore().catch((error) => {
    cache.newbStore = undefined; // 다음 요청에서 다시 시도
    throw error;
  }));
}

async function createStore(): Promise<ObjectStore> {
  if (process.env.OCI_AUTH) {
    const { createOciStore } = await import("./storage-oci");
    return createOciStore(process.env);
  }
  const { createS3Store } = await import("./storage-s3");
  return createS3Store(process.env);
}

export async function checkBucket(signal?: AbortSignal) {
  await (await store()).check(signal);
}

export async function putObject(key: string, body: Uint8Array | string, contentType: string) {
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
  await (await store()).put(key, bytes, contentType);
}

export async function getObjectBytes(key: string) {
  return (await store()).get(key);
}

export async function deleteObject(key: string) {
  await (await store()).delete(key);
}
