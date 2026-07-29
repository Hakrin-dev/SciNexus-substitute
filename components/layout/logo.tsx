import Link from "next/link";
import Image from "next/image";
import { SITE } from "@/lib/constants";

/** 品牌标识:日/夜双版书法成品(brand/ 定稿),随 html.dark 切换 */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 outline-none">
      <Image
        src="/brand/logo-day.png"
        alt="深知"
        width={36}
        height={36}
        className="size-9 rounded-[10px] dark:hidden"
        priority
      />
      <Image
        src="/brand/logo-night.png"
        alt="深知"
        width={36}
        height={36}
        className="hidden size-9 rounded-[10px] dark:block"
        priority
      />
      {!compact && (
        <span className="flex flex-col leading-tight">
          <span className="text-[17px] font-bold text-ink">{SITE.name}</span>
          <span className="text-[10px] text-faint">{SITE.fullName}</span>
        </span>
      )}
    </Link>
  );
}
