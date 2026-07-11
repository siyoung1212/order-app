import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 상품 이미지가 PRODUCTS.image_url에 임의의 외부 URL로 저장되므로 <img> 태그를 사용합니다.
    // next/image의 원격 도메인 화이트리스트를 쓰려면 여기에 remotePatterns를 추가하세요.
  },
};

export default nextConfig;
