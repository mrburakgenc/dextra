import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Derleme çıktısı kök .gitignore'un zaten yok saydığı klasöre yazılır (TS-004).
  distDir: 'dist',
};

export default nextConfig;
