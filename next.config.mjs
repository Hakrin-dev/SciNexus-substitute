/** Vercel 构建时会注入 VERCEL=1;据此区分平台专属配置 */
const isVercel = !!process.env.VERCEL;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone 仅供 Docker 镜像使用;Vercel 走平台默认产物,必须关闭
  ...(isVercel ? {} : { output: 'standalone' }),
  // Vercel Serverless:better-sqlite3 是原生模块,禁打包、运行时从 node_modules 加载
  ...(isVercel ? { serverExternalPackages: ['better-sqlite3'] } : {}),
  // Vercel 函数包默认不含运行时拼路径引用的文件,显式把 SQLite 库打进 /api/** 的 tracing
  ...(isVercel
    ? { outputFileTracingIncludes: { '/api/**': ['./data/yanshu.db'] } }
    : {}),
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
