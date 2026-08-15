import type { Metadata } from "next";
import type { ReactNode } from "react";
import { QueryProvider } from "@/providers/query-provider";
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
