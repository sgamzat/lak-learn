/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Оптимизатор картинок (/_next/image) не используется (next/image в коде нет),
  // но включён по умолчанию, а в ветке Next 14 у него неисправленные уязвимости
  // (RCE через AVIF/SVG, DoS, неограниченный рост дискового кеша).
  images: { unoptimized: true }
};

export default nextConfig;
