"use client";

import { create } from "zustand";
import client, { setToken, getToken } from "@/lib/api/client";

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
  /** 登录 token（持久化到 localStorage） */
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
  logout: () => void;
  /** 拉取当前用户（页面初始化调用） */
  restore: () => Promise<void>;
  /** 演示登录（直接写死） */
  demoLogin: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  loading: false,
  token: typeof window !== "undefined" ? getToken() : null,
  user: null,
  userName: null,

  login: async (username, password) => {
    try {
      set({ loading: true });
      const resp = await client.auth.login(username, password);
      if (!resp.success) return { ok: false, error: resp.error || "登录失败" };
      const token = resp.data!.token;
      const user = resp.data!.user as AuthUser;
      setToken(token);
      set({
        token,
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
      const token = resp.data!.token;
      const user = resp.data!.user as AuthUser;
      setToken(token);
      set({
        token,
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

  logout: () => {
    setToken(null);
    set({ token: null, user: null, userName: null });
  },

  restore: async () => {
    const token = getToken();
    if (!token) return;
    try {
      set({ loading: true });
      const resp = await client.auth.me();
      if (resp.success && resp.data) {
        const user = resp.data as AuthUser;
        set({
          token,
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

  demoLogin: () => {
    // 兼容旧的演示登录
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
