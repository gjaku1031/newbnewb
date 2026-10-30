import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { ObjectStore } from "./storage";

/** S3 호환 API (로컬 RustFS 등) */
export function createS3Store(env: Record<string, string | undefined>): ObjectStore {
  const { S3_ENDPOINT: endpoint, S3_ACCESS_KEY_ID: accessKeyId, S3_SECRET_ACCESS_KEY: secretAccessKey, S3_BUCKET: bucket } = env;
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Object Storage 설정이 없어요: OCI_AUTH(운영) 또는 S3_ENDPOINT·S3_BUCKET·S3_ACCESS_KEY_ID·S3_SECRET_ACCESS_KEY(로컬)");
  }
  const client = new S3Client({
    endpoint,
    region: env.S3_REGION ?? "us-east-1",
    credentials: { accessKeyId, secretAccessKey },
    // RustFS 등은 버킷을 경로에 넣는 방식만 지원
    forcePathStyle: true,
    // SDK 기본 CRC 체크섬 헤더를 받지 않는 S3 호환 서버가 있어 필요할 때만 보냄
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  return {
    kind: "s3",
    async check(signal) {
      await client.send(new HeadBucketCommand({ Bucket: bucket }), { abortSignal: signal });
    },
    async put(key, body, contentType) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
    },
    async get(key) {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!res.Body) throw new Error(`빈 객체: ${key}`);
      return res.Body.transformToByteArray();
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}
