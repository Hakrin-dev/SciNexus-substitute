"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * `/agents/deep-search` —— 兼容重定向:
 * AI 对话已合并为单容器 /agents(深度模式为其中一种回答形态),
 * 旧链接携带 q/mode 参数原样迁移,保证发现页等入口不断链。
 */
function DeepSearchRedirect() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const qs = new URLSearchParams();
    const q = params.get("q");
    const mode = params.get("mode");
    if (q) qs.set("q", q);
    if (mode) qs.set("mode", mode);
    router.replace(qs.toString() ? `/agents?${qs.toString()}` : "/agents");
  }, [router, params]);

  return null;
}

export default function DeepSearchRedirectPage() {
  return (
    <Suspense fallback={null}>
      <DeepSearchRedirect />
    </Suspense>
  );
}
