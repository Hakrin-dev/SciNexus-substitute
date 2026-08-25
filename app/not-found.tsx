import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

/** 全局 404 页 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft">
        <Compass className="size-6 text-primary" />
      </span>
      <h1 className="text-lg font-semibold text-ink">页面不存在</h1>
      <p className="max-w-md text-sm leading-relaxed text-muted">
        你访问的页面可能已被移动或删除。
      </p>
      <Link href="/">
        <Button className="mt-1">返回发现页</Button>
      </Link>
    </div>
  );
}
