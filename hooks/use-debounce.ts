"use client";

import { useEffect, useState } from "react";

/** 输入防抖(默认 300ms,见 README 5.2 交互增强) */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
