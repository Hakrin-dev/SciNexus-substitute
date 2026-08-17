"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface CountdownProps {
  label: string;
  dateText: string;
  /** 相对挂载时间的毫秒偏移(演示用) */
  offsetMs: number;
}

const UNITS = ["天", "小时", "分钟", "秒"] as const;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** 截稿倒计时 —— 客户端实时走动(README 5.2 交互增强) */
export function Countdown({ label, dateText, offsetMs }: CountdownProps) {
  const [remain, setRemain] = useState<number | null>(null);

  useEffect(() => {
    const deadline = Date.now() + offsetMs;
    const tick = () => setRemain(Math.max(0, deadline - Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [offsetMs]);

  const total = remain ?? offsetMs;
  const days = Math.floor(total / 86_400_000);
  const hours = Math.floor((total % 86_400_000) / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const values = [pad(days), pad(hours), pad(minutes), pad(seconds)];
  const urgent = days === 0;

  return (
    <div className="mt-4 flex items-center justify-between rounded-xl bg-panel px-5 py-4">
      <div className="flex flex-col gap-1.5">
        <span className="inline-flex w-fit items-center rounded-md bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
          {label}
        </span>
        <span className="text-[13px] text-muted">{dateText}</span>
      </div>

      <div className="flex items-start gap-4">
        {values.map((value, i) => (
          <div key={UNITS[i]} className="flex items-start gap-4">
            <div className="flex w-11 flex-col items-center gap-0.5">
              <span className="text-[28px] font-bold leading-none tabular-nums text-danger">
                {value}
              </span>
              <span className="text-[11px] text-faint">{UNITS[i]}</span>
            </div>
            {i < 3 && (
              <span className="-mx-2 text-xl font-bold leading-[28px] text-danger">
                :
              </span>
            )}
          </div>
        ))}
      </div>

      <span
        className={cn(
          "rounded-full px-3 py-1 text-xs font-medium",
          urgent ? "bg-danger-soft text-danger" : "bg-chip text-muted",
        )}
      >
        {urgent ? "紧急" : "进行中"}
      </span>
    </div>
  );
}
