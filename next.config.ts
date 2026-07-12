import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist runs server-side for show-bill text extraction; keep it
  // external so the bundler doesn't try to inline its worker machinery.
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
