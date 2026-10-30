import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 이미지용 최소 실행 파일 (.next/standalone)
  output: "standalone",
  // 오른쪽 아래는 Agentation 주석 툴바 자리라 Next 개발 배지는 끔 (에러 오버레이는 그대로 뜸)
  devIndicators: false,
  // 다른 기기(Tailscale 등)에서 개발 서버에 접속할 때 허용할 주소 — 쉼표로 구분 (예: DEV_ORIGINS=100.x.x.x,my-host)
  allowedDevOrigins: (process.env.DEV_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
