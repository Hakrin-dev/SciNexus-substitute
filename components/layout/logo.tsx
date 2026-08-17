import Link from "next/link";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import wordmark from "@/brand/logo-wordmark.png";
import { SITE } from "@/lib/constants";

/**
 * 品牌标识:
 * - 展开态:SciNexus 英文 wordmark(自 brand/logo.png 提取,透明底,日夜间通用),
 *   withName 时右侧附带中文名「研枢」
 * - 折叠态(compact):AI 助手页同款三十字星(lucide Sparkles),与 app/icon.png 一致
 */
export function Logo({
  compact = false,
  withName = true,
}: {
  compact?: boolean;
  withName?: boolean;
}) {
  if (compact) {
    return (
      <Link
        href="/"
        aria-label={`${SITE.name}首页`}
        title={SITE.name}
        className="flex size-9 items-center justify-center rounded-[10px] bg-primary shadow-sm outline-none"
      >
        <Sparkles className="size-[18px] text-white" strokeWidth={1.8} />
      </Link>
    );
  }

  return (
    <Link href="/" className="flex items-center gap-2.5 outline-none">
      <Image
        src={wordmark}
        alt={`${SITE.fullName} ${SITE.name}`}
        className="h-7 w-auto"
        priority
      />
      {withName && (
        <span className="text-[17px] font-bold text-ink">{SITE.name}</span>
      )}
    </Link>
  );
}
