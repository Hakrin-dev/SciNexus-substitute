"use client";

import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserPreferences } from "@/stores/user-preferences";
import { cn } from "@/lib/utils";

/** 关注按钮 —— Zustand 持久化关注状态(原型中 已关注/关注 两态) */
export function FollowButton({
  scholarId,
  defaultFollowing = false,
  className,
}: {
  scholarId: string;
  defaultFollowing?: boolean;
  className?: string;
}) {
  const { followedScholars, toggleFollow } = useUserPreferences();
  const following = followedScholars[scholarId] ?? defaultFollowing;

  return (
    <Button
      variant={following ? "soft" : "outline"}
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        toggleFollow(scholarId);
      }}
      className={cn("rounded-full px-3.5", className)}
    >
      {following ? (
        <>
          <Check className="size-3.5" />
          已关注
        </>
      ) : (
        <>
          <Plus className="size-3.5" />
          关注
        </>
      )}
    </Button>
  );
}
