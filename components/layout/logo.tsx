import Link from "next/link";
import Image from "next/image";
import logoDay from "@/brand/logo-day.png";
import logoNight from "@/brand/logo-night.png";
import { SITE } from "@/lib/constants";

/** 品牌标识:日/夜双版书法成品(brand/ 定稿),随 html.dark 切换(日夜互换展示) */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 outline-none">
      <Image
        src={logoNight}
        alt="深知"
        className="size-9 rounded-[10px] dark:hidden"
        priority
      />
      <Image
        src={logoDay}
        alt="深知"
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
