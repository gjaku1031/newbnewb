import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Object Storage (S3 호환 API)
 *
 * 로컬: compose.yaml의 RustFS  → S3_ENDPOINT=http://127.0.0.1:19000
 * 운영: OCI Object Storage     → S3_ENDPOINT=https://<namespace>.compat.objectstorage.<region>.oraclecloud.com
 *
 * S3_REGION             OCI는 리전 이름 (예: ap-tokyo-1)
 * S3_BUCKET             버킷 이름
 * S3_ACCESS_KEY_ID      OCI는 사용자의 "고객 비밀 키(Customer Secret Key)"
 * S3_SECRET_ACCESS_KEY
 */
function createClient() {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY가 필요합니다");
  }
  return new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? "us-east-1",
    credentials: { accessKeyId, secretAccessKey },
    // OCI·RustFS 모두 버킷을 경로에 넣는 방식만 지원
    forcePathStyle: true,
    // SDK 기본 CRC 체크섬 헤더를 OCI가 받지 않아 필요할 때만 보냄
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

const cache = globalThis as unknown as { newbS3?: S3Client };

function client() {
  return (cache.newbS3 ??= createClient());
}

function bucket() {
  const name = process.env.S3_BUCKET;
  if (!name) throw new Error("S3_BUCKET이 설정되지 않았습니다");
  return name;
}

export async function checkBucket(signal?: AbortSignal) {
  await client().send(new HeadBucketCommand({ Bucket: bucket() }), { abortSignal: signal });
}

export async function putObject(key: string, body: Uint8Array | string, contentType: string) {
  await client().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }),
  );
}

export async function getObjectBytes(key: string) {
  const res = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!res.Body) throw new Error(`빈 객체: ${key}`);
  return res.Body.transformToByteArray();
}

export async function deleteObject(key: string) {
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
