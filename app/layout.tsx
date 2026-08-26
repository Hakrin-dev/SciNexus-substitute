import type { Metadata } from "next";
import type { ReactNode } from "react";
import { QueryProvider } from "@/providers/query-provider";
import { StoreHydration } from "@/providers/store-hydration";
import { Toaster } from "@/components/layout/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "研枢 SciNexus",
  description: "研枢 —— 面向科研工作者的论文发现、投稿跟踪与 AI 研究助手平台",
};

/**
 * 首屏前确定主题,避免闪烁:
 * ?theme=dark|light|system(调试/分享)> localStorage("dark"|"light"|"system")> 系统偏好
 */
const themeScript = `(function(){try{var p=new URLSearchParams(location.search).get("theme");var t=p==="dark"||p==="light"||p==="system"?p:localStorage.getItem("scinexus-theme");var m=window.matchMedia("(prefers-color-scheme: dark)").matches;var d=t==="dark"||(t!=="light"&&m);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

/**
 * 仅开发环境:Next/React 的 dev 性能埋点(Performance 面板 Components 轨道)
 * 在切页计时不一致时会抛出 "'XxxPage' cannot have a negative time stamp"
 * 的 SyntaxError —— 框架侧已知问题,与业务代码无关,生产构建不含此埋点。
 * 这里防御性吞掉该特定错误,其余错误照常抛出。
 */
const devPerfPatchScript = `(function(){var m=performance.measure.bind(performance);performance.measure=function(n,s,e){try{return m(n,s,e)}catch(err){if(err&&err.name==="SyntaxError")return undefined;throw err}}})()`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV === "development" && (
          <script dangerouslySetInnerHTML={{ __html: devPerfPatchScript }} />
        )}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <QueryProvider>
          <StoreHydration />
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
