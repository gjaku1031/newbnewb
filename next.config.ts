import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 오른쪽 아래는 Agentation 주석 툴바 자리라 Next 개발 배지는 끔 (에러 오버레이는 그대로 뜸)
  devIndicators: false,
  // Tailscale 주소로 접속하는 개발 환경 허용
  allowedDevOrigins: ["100.74.22.40", "oci-dev"],
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
