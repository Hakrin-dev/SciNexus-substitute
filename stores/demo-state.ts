"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { notesMock, type NoteItem } from "@/lib/data/notes";
import { memoryMock, type MemoryEntry } from "@/lib/data/memory";
import {
  mcpServersMock,
  pluginsMock,
  communitySkillsMock,
  type CustomSkill,
  type McpServer,
} from "@/lib/data/tools";

/* ── 类型 ───────────────────────────────────────────────────── */

export interface ApiKeyItem {
  id: string;
  name: string;
  /** 完整 key 仅创建时可见,持久化的为掩码 */
  masked: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface AgentPref {
  enabled: boolean;
  model: string;
}

interface DemoState {
  /* 知识库·笔记(前端演示 CRUD) */
  notes: NoteItem[];
  addNote: (note: Omit<NoteItem, "id" | "updatedAt">) => void;
  updateNote: (id: string, patch: Partial<Omit<NoteItem, "id">>) => void;
  deleteNote: (id: string) => void;

  /* 知识库·AI 记忆 */
  memoryEnabled: boolean;
  setMemoryEnabled: (v: boolean) => void;
  memoryEntries: MemoryEntry[];
  memoryOff: Record<string, boolean>;
  toggleMemoryEntry: (id: string) => void;
  deleteMemoryEntry: (id: string) => void;

  /* 工具库·技能启用 */
  skillsOn: Record<string, boolean>;
  toggleSkill: (id: string) => void;
  isSkillOn: (id: string) => boolean;

  /* 工具库·社区技能(安装态) */
  communityInstalled: Record<string, boolean>;
  toggleCommunityInstall: (id: string) => void;

  /* 工具库·自定义技能(含 skill.md;发布/编辑/删除) */
  customSkills: CustomSkill[];
  addCustomSkill: (s: Omit<CustomSkill, "id">) => void;
  updateCustomSkill: (id: string, patch: Partial<Omit<CustomSkill, "id">>) => void;
  deleteCustomSkill: (id: string) => void;
  toggleCustomPublished: (id: string) => void;

  /* 工具库·插件安装态 */
  pluginInstalled: Record<string, boolean>;
  togglePlugin: (id: string) => void;

  /* 工具库·MCP 服务器 */
  mcpServers: McpServer[];
  toggleMcpConnected: (id: string) => void;
  addMcpServer: (server: Omit<McpServer, "id">) => void;

  /* 设置·API Keys(演示) */
  apiKeys: ApiKeyItem[];
  addApiKey: (key: ApiKeyItem) => void;
  removeApiKey: (id: string) => void;

  /* 设置·Agent 偏好(演示) */
  agentDefaultModel: string;
  agentPrefs: Record<string, AgentPref>;
  setAgentDefaultModel: (model: string) => void;
  setAgentPref: (agent: string, patch: Partial<AgentPref>) => void;
}

/** 由 mock 派生的初始值(仅首次进入持久化存储时生效) */
const initialPluginInstalled = Object.fromEntries(
  pluginsMock.map((p) => [p.id, p.installed]),
);

const DEFAULT_AGENT_MODELS: Record<string, string> = {
  scout: "API接入",
  librarian: "API接入",
  synthesis: "API接入",
  research_design: "API接入",
  code_assistant: "API接入",
  writer: "订阅",
  critic: "订阅",
};

/**
 * 演示页统一本地状态(zustand persist,键 scinexus-demo):
 * 笔记 CRUD / AI 记忆 / 技能插件开关 / MCP 连接 / API Keys / Agent 偏好。
 * 全部为界面演示数据,不落服务端数据库。
 */
export const useDemoState = create<DemoState>()(
  persist(
    (set, get) => ({
      notes: notesMock,
      addNote: (note) =>
        set((s) => ({
          notes: [
            {
              ...note,
              id: `n-${Date.now().toString(36)}`,
              updatedAt: new Date().toISOString(),
            },
            ...s.notes,
          ],
        })),
      updateNote: (id, patch) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n,
          ),
        })),
      deleteNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      memoryEnabled: true,
      setMemoryEnabled: (v) => set({ memoryEnabled: v }),
      memoryEntries: memoryMock,
      memoryOff: {},
      toggleMemoryEntry: (id) =>
        set((s) => ({ memoryOff: { ...s.memoryOff, [id]: !s.memoryOff[id] } })),
      deleteMemoryEntry: (id) =>
        set((s) => {
          const memoryOff = { ...s.memoryOff };
          delete memoryOff[id];
          return {
            memoryEntries: s.memoryEntries.filter((m) => m.id !== id),
            memoryOff,
          };
        }),

      skillsOn: {},
      toggleSkill: (id) =>
        set((s) => ({ skillsOn: { ...s.skillsOn, [id]: !get().isSkillOn(id) } })),
      isSkillOn: (id) => get().skillsOn[id] ?? true,

      communityInstalled: Object.fromEntries(
        communitySkillsMock.slice(0, 1).map((c) => [c.id, true]),
      ),
      toggleCommunityInstall: (id) =>
        set((s) => ({
          communityInstalled: { ...s.communityInstalled, [id]: !s.communityInstalled[id] },
        })),

      customSkills: [],
      addCustomSkill: (skill) =>
        set((s) => ({
          customSkills: [
            { ...skill, id: `cs-${Date.now().toString(36)}` },
            ...s.customSkills,
          ],
        })),
      updateCustomSkill: (id, patch) =>
        set((s) => ({
          customSkills: s.customSkills.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      deleteCustomSkill: (id) =>
        set((s) => ({ customSkills: s.customSkills.filter((c) => c.id !== id) })),
      toggleCustomPublished: (id) =>
        set((s) => ({
          customSkills: s.customSkills.map((c) =>
            c.id === id ? { ...c, published: !c.published } : c,
          ),
        })),

      pluginInstalled: initialPluginInstalled,
      togglePlugin: (id) =>
        set((s) => ({
          pluginInstalled: { ...s.pluginInstalled, [id]: !s.pluginInstalled[id] },
        })),

      mcpServers: mcpServersMock,
      toggleMcpConnected: (id) =>
        set((s) => ({
          mcpServers: s.mcpServers.map((m) =>
            m.id === id ? { ...m, connected: !m.connected } : m,
          ),
        })),
      addMcpServer: (server) =>
        set((s) => ({
          mcpServers: [...s.mcpServers, { ...server, id: `mcp-${Date.now().toString(36)}` }],
        })),

      apiKeys: [
        {
          id: "key-1",
          name: "个人开发",
          masked: "sk-demo-7fKx********9QzL",
          createdAt: "2026-07-02",
          lastUsedAt: "2026-08-24",
        },
        {
          id: "key-2",
          name: "实验室共享",
          masked: "sk-demo-2mNv********4RtY",
          createdAt: "2026-07-18",
        },
      ],
      addApiKey: (key) => set((s) => ({ apiKeys: [key, ...s.apiKeys] })),
      removeApiKey: (id) => set((s) => ({ apiKeys: s.apiKeys.filter((k) => k.id !== id) })),

      agentDefaultModel: "API接入",
      agentPrefs: Object.fromEntries(
        Object.entries(DEFAULT_AGENT_MODELS).map(([agent, model]) => [
          agent,
          { enabled: true, model },
        ]),
      ),
      setAgentDefaultModel: (model) => set({ agentDefaultModel: model }),
      setAgentPref: (agent, patch) =>
        set((s) => ({
          agentPrefs: {
            ...s.agentPrefs,
            [agent]: { ...(s.agentPrefs[agent] ?? { enabled: true, model: "API接入" }), ...patch },
          },
        })),
    }),
    {
      name: "scinexus-demo",
      skipHydration: true,
    },
  ),
);
