"use client";

import { create } from "zustand";
import client, { setToken } from "@/lib/api/client";

export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  display_name: string | null;
  avatar_color: string;
}

interface AuthState {
  /** 是否正在加载 */
  loading: boolean;
  /** 仅表示当前会话已认证；真实 token 存在 HttpOnly Cookie 中。 */
  token: string | null;
  /** 当前登录用户（未登录为 null） */
  user: AuthUser | null;
  /** 便捷属性：显示名 */
  userName: string | null;
  /** 登录 */
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  /** 注册 */
  register: (params: {
    username: string;
    password: string;
    email?: string;
    displayName?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  /** 登出 */
  logout: () => Promise<void>;
  /** 拉取当前用户（页面初始化调用） */
  restore: () => Promise<void>;
  /** 演示登录（优先真实接口,失败退回纯前端演示态） */
  demoLogin: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  loading: false,
  token: null,
  user: null,
  userName: null,

  login: async (username, password) => {
    try {
      set({ loading: true });
      const resp = await client.auth.login(username, password);
      if (!resp.success) return { ok: false, error: resp.error || "登录失败" };
      const user = resp.data!.user as AuthUser;
      setToken(null);
      set({
        token: "cookie-session",
        user,
        userName: user.display_name || user.username,
        loading: false,
      });
      return { ok: true };
    } catch (e) {
      set({ loading: false });
      return { ok: false, error: e instanceof Error ? e.message : "登录失败" };
    }
  },

  register: async (params) => {
    try {
      set({ loading: true });
      const resp = await client.auth.register(params);
      if (!resp.success) return { ok: false, error: resp.error || "注册失败" };
      const user = resp.data!.user as AuthUser;
      setToken(null);
      set({
        token: "cookie-session",
        user,
        userName: user.display_name || user.username,
        loading: false,
      });
      return { ok: true };
    } catch (e) {
      set({ loading: false });
      return { ok: false, error: e instanceof Error ? e.message : "注册失败" };
    }
  },

  logout: async () => {
    try { await client.auth.logout(); } catch { /* 本地状态仍需清除 */ }
    setToken(null);
    set({ token: null, user: null, userName: null });
  },

  restore: async () => {
    try {
      set({ loading: true });
      const resp = await client.auth.me();
      if (resp.success && resp.data) {
        const user = resp.data as AuthUser;
        set({
          token: "cookie-session",
          user,
          userName: user.display_name || user.username,
          loading: false,
        });
      } else {
        setToken(null);
        set({ token: null, user: null, userName: null, loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  /** 演示登录:优先走真实接口拿 token(后续 requireAuth 接口可用),后端不可用时退回纯前端演示态 */
  demoLogin: async () => {
    const result = await get().login("hankairun", "yanshu123");
    if (result.ok) return;
    set({
      user: {
        id: "user_demo",
        username: "hankairun",
        email: null,
        display_name: "韩凯润",
        avatar_color: "#5046E5",
      },
      userName: "韩凯润",
    });
  },
}));
