"use client";

import * as React from "react";

/**
 * Cloudflare Turnstile 前端组件
 *
 * 仅在 NEXT_PUBLIC_TURNSTILE_SITE_KEY 配置时渲染。
 * 验证成功后通过 onVerify 回调传递 token。
 */

const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export interface TurnstileProps {
  /** 验证成功回调，参数为 Turnstile token */
  onVerify: (token: string) => void;
  /** 验证过期/出错回调 */
  onError?: () => void;
  className?: string;
}

// 全局脚本加载状态，避免重复注入
let scriptLoading: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("window 未定义"));
      return;
    }
    // 已存在则直接返回
    if ((window as any).turnstile) {
      resolve();
      return;
    }
    const existing = document.querySelector(
      `script[src="${TURNSTILE_SCRIPT_SRC}"]`,
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Turnstile 脚本加载失败")));
      return;
    }
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile 脚本加载失败"));
    document.head.appendChild(script);
  });
  return scriptLoading;
}

export function Turnstile({ onVerify, onError, className }: TurnstileProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const widgetIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const turnstile = (window as any).turnstile;
        if (!turnstile) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => onVerify(token),
          "error-callback": () => onError?.(),
          "expired-callback": () => onError?.(),
        });
      })
      .catch(() => onError?.());

    return () => {
      cancelled = true;
      if (widgetIdRef.current && (window as any).turnstile) {
        try {
          (window as any).turnstile.remove(widgetIdRef.current);
        } catch {
          // 忽略
        }
      }
    };
  }, [siteKey, onVerify, onError]);

  // 未配置 siteKey 时不渲染
  if (!siteKey) return null;

  return <div ref={containerRef} className={className} />;
}

/** Turnstile 是否已在前端配置（供调用方判断是否需要传 token）。 */
export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}
