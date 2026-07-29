import { AppShell } from "@/components/layout/app-shell";
import { DirectionFilter } from "@/components/features/scholar/direction-filter";
import { ScholarsBrowser } from "@/components/features/scholar/scholars-browser";

/** 学者画像页 `/scholars` —— 对应「深知-学者画像页.svg」 */
export default function ScholarsPage() {
  return (
    <AppShell>
      <div className="mx-auto flex max-w-[1180px] items-start gap-8 px-8 py-6">
        <DirectionFilter />
        <ScholarsBrowser />
      </div>
    </AppShell>
  );
}
