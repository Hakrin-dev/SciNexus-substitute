import { AppShell } from "@/components/layout/app-shell";
import { SearchHero } from "@/components/features/search/search-hero";
import { FeedTabs } from "@/components/features/search/feed-tabs";
import { FeedList } from "@/components/features/search/feed-list";

/** 主发现页 `/` —— 对应「深知-主发现页.svg」 */
export default function HomePage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1080px] space-y-5 px-8 py-6">
        <SearchHero />
        <FeedTabs />
        <FeedList />
      </div>
    </AppShell>
  );
}
