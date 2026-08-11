"use client";

import { create } from "zustand";

/** 演示用登录态:login 后用户卡片显示「韩凯润」,logout 回到「未登录」 */
interface AuthState {
  userName: string | null;
  login: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  userName: null,
  login: () => set({ userName: "韩凯润" }),
  logout: () => set({ userName: null }),
}));
