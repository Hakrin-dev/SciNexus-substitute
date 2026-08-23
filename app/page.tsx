import { AppShell } from "@/components/layout/app-shell";
import { HomeFeed } from "@/components/features/search/home-feed";

/** 主发现页 `/` —— 对应「深知-主发现页.svg」 */
export default function HomePage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1080px] space-y-5 px-8 py-6">
        <HomeFeed />
      </div>
    </AppShell>
  );
}
