/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // 阻断流式直至元数据完成,使动态路由 notFound() 能返回真实 404 状态码
  htmlLimitedBots: /.*/,
  reactStrictMode: true,
   allowedDevOrigins: [
    '192.168.1.19',
    '10.197.73.12',
    'localhost',
    '127.0.0.1'
  ]
};

export default nextConfig;
