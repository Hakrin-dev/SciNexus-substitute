"use client";

import { create } from "zustand";
import client, { apiPost, getToken, setToken } from "@/lib/api/client";

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
  /** 会话标记；真实 token 只存在 HttpOnly Cookie，前端不可读取。 */
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
  /** 发送注册邮箱验证码 */
  sendRegisterOtp: (email: string, captchaToken?: string) => Promise<{ ok: boolean; challengeId?: string; error?: string }>;
  /** 验证注册邮箱验证码（成功后后端签发 ticket Cookie） */
  verifyRegisterOtp: (params: {
    email: string;
    challengeId: string;
    otp: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  /** 发送登录邮箱验证码 */
  sendLoginOtp: (email: string, captchaToken?: string) => Promise<{ ok: boolean; challengeId?: string; error?: string }>;
  /** 验证登录邮箱验证码（成功后建立登录态） */
  verifyLoginOtp: (params: {
    email: string;
    challengeId: string;
    otp: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  /** 登出 */
  logout: () => void;
  /** 拉取当前用户（页面初始化调用） */
  restore: () => Promise<void>;
  /** 演示登录（仅在真实接口成功时建立可访问后端的登录态） */
  demoLogin: () => Promise<boolean>;
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
      set({
        token: getToken() || "cookie",
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
      set({
        token: getToken() || "cookie",
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

  sendRegisterOtp: async (email, captchaToken) => {
    try {
      const resp = await client.auth.sendRegisterOtp(email, captchaToken);
      if (!resp.success) return { ok: false, error: resp.error || "发送验证码失败" };
      return { ok: true, challengeId: resp.data?.challengeId };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "发送验证码失败" };
    }
  },

  verifyRegisterOtp: async (params) => {
    try {
      const resp = await client.auth.verifyRegisterOtp(params);
      if (!resp.success) return { ok: false, error: resp.error || "验证失败" };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "验证失败" };
    }
  },

  sendLoginOtp: async (email, captchaToken) => {
    try {
      const resp = await client.auth.sendLoginOtp(email, captchaToken);
      if (!resp.success) return { ok: false, error: resp.error || "发送验证码失败" };
      return { ok: true, challengeId: resp.data?.challengeId };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "发送验证码失败" };
    }
  },

  verifyLoginOtp: async (params) => {
    try {
      set({ loading: true });
      const resp = await client.auth.verifyLoginOtp(params);
      if (!resp.success) return { ok: false, error: resp.error || "验证失败" };
      const user = resp.data!.user as AuthUser;
      set({
        token: getToken() || "cookie",
        user,
        userName: user.display_name || user.username,
        loading: false,
      });
      return { ok: true };
    } catch (e) {
      set({ loading: false });
      return { ok: false, error: e instanceof Error ? e.message : "验证失败" };
    }
  },

  logout: () => {
    setToken(null);
    set({ token: null, user: null, userName: null });
    void apiPost("/api/auth/logout", {}).catch(() => undefined);
  },

  restore: async () => {
    try {
      set({ loading: true });
      const resp = await client.auth.me();
      if (resp.success && resp.data) {
        const user = resp.data as AuthUser;
        set({
          token: getToken() || "cookie",
          user,
          userName: user.display_name || user.username,
          loading: false,
        });
      } else {
        set({ token: null, user: null, userName: null, loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  /** 演示登录:优先走真实接口拿 token，后端不可用时不建立登录态 */
  demoLogin: async () => {
    const result = await get().login("hankairun", "yanshu123");
    return result.ok;
  },
}));
