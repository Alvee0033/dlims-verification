/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true
  },
  async rewrites() {
    return [
      {
        source: '/verify.php',
        destination: '/'
      }
    ];
  }
};

export default nextConfig;
