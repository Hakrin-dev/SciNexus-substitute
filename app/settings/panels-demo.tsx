"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Info, KeyRound, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet } from "@/lib/api/client";
import { useDemoState } from "@/stores/demo-state";
import { copyText, toast } from "@/stores/toast";
import { cn } from "@/lib/utils";

/* ═══ 用量统计(配额为演示数值;平台统计来自 /api/stats/detailed)═══ */

interface PlatformStats {
  papers: { total: number; by_ccf: Record<string, number> };
  journals?: { total?: number };
  library: { total: number };
  conversations: { total: number };
  notifications: { total: number };
}

/** 接口为扁平信封(无 data 包装),缺字段时抛错走 retry:false 的空态 */
function usePlatformStats() {
  return useQuery({
    queryKey: ["api", "stats", "detailed"],
    queryFn: async (): Promise<PlatformStats> => {
      const json = (await apiGet<PlatformStats>("/api/stats/detailed")) as unknown as PlatformStats;
      if (!json?.papers) throw new Error("stats unavailable");
      return {
        papers: json.papers,
        journals: json.journals,
        library: json.library,
        conversations: json.conversations,
        notifications: json.notifications,
      };
    },
    staleTime: 60_000,
    retry: false,
  });
}

function QuotaCard({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-ink">
        {used}
        <span className="text-sm font-normal text-faint"> / {limit}</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-chip">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            used / limit >= 0.9 ? "bg-danger" : "bg-primary",
          )}
          style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
        />
      </div>
    </div>
  );
}

/* ── 近7日用量柱状图(横轴时间/纵轴用量,每家大模型一色,堆叠;示意数据)── */

interface ChartModel {
  name: string;
  color: string;
}

const CHART_MODELS: ChartModel[] = [
  { name: "GPT 系列", color: "#f59e0b" },
  { name: "Claude", color: "#f07c00" },
  { name: "Gemini", color: "#0ea5e9" },
  { name: "Kimi", color: "#6366f1" },
  { name: "GLM", color: "#10b981" },
];

/** [天][模型] 调用次数 */
const WEEK_DATA: number[][] = [
  [4, 2, 1, 2, 0],
  [2, 1, 2, 1, 1],
  [5, 3, 2, 2, 1],
  [3, 2, 1, 1, 0],
  [6, 4, 3, 3, 2],
  [2, 1, 1, 0, 1],
  [4, 3, 2, 2, 1],
];

const WEEK_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function UsageBars() {
  const dayTotals = WEEK_DATA.map((day) => day.reduce((a, b) => a + b, 0));
  const maxY = Math.max(...dayTotals);
  // 纵轴刻度:取略高于最大值的整十数
  const yTop = Math.ceil(maxY / 5) * 5 || 5;
  const ticks = [yTop, Math.round(yTop / 2), 0];

  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs text-muted">
          近 7 日模型调用量
          <span className="rounded bg-chip px-1.5 py-0.5 text-[10px] text-faint">示意</span>
        </p>
        {/* 图例 */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {CHART_MODELS.map((m) => (
            <span key={m.name} className="flex items-center gap-1 text-[10px] text-muted">
              <span
                className="inline-block size-2 rounded-sm"
                style={{ backgroundColor: m.color }}
              />
              {m.name}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex">
        {/* 纵轴 */}
        <div className="flex w-8 shrink-0 flex-col justify-between pb-6 text-right text-[10px] tabular-nums text-faint">
          {ticks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        {/* 绘图区 */}
        <div className="relative min-w-0 flex-1">
          {/* 横向网格线 */}
          <div className="absolute inset-x-0 top-0 flex h-[120px] flex-col justify-between">
            {ticks.map((t) => (
              <div key={t} className="border-t border-line/70" />
            ))}
          </div>
          {/* 柱体(按模型堆叠) */}
          <div className="relative flex h-[120px] items-end justify-between gap-2 sm:gap-4">
            {WEEK_DATA.map((day, di) => {
              const total = day.reduce((a, b) => a + b, 0);
              return (
                <div key={di} className="group relative flex h-full flex-1 flex-col justify-end">
                  <span className="mb-1 text-center text-[10px] tabular-nums text-faint opacity-0 transition-opacity group-hover:opacity-100">
                    {total}
                  </span>
                  {/* 从下往上按模型顺序堆叠 */}
                  <div className="flex w-full flex-col-reverse">
                    {day.map((v, mi) =>
                      v > 0 ? (
                        <div
                          key={mi}
                          title={`${CHART_MODELS[mi].name}:${v} 次`}
                          className="w-full transition-opacity hover:opacity-80"
                          style={{
                            height: `${(v / yTop) * 100}%`,
                            backgroundColor: CHART_MODELS[mi].color,
                            borderTop:
                              mi === day.length - 1 || day[mi + 1] === 0
                                ? "none"
                                : undefined,
                          }}
                        />
                      ) : null,
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* 横轴 */}
      <div className="ml-8 flex justify-between gap-2 sm:gap-4">
        {WEEK_LABELS.map((label) => (
          <span key={label} className="flex-1 text-center text-[10px] text-faint">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function UsagePanel() {
  const { data: stats } = usePlatformStats();

  return (
    <div className="space-y-5">
      {/* 本月配额(演示数值) */}
      <section>
        <h3 className="text-[15px] font-semibold text-ink">本月用量</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <QuotaCard label="快速检索" used={12} limit={50} />
          <QuotaCard label="深度研究" used={3} limit={10} />
          <QuotaCard label="文献翻译(篇)" used={7} limit={30} />
        </div>
        <p className="mt-2 flex items-center gap-1 text-[11px] text-faint">
          <Info className="size-3" />
          配额随订阅方案变化;当前为演示环境固定值
        </p>
      </section>

      {/* 近期趋势 */}
      <section>
        <UsageBars />
      </section>

      {/* 平台数据(真实接口) */}
      <section>
        <h3 className="text-[15px] font-semibold text-ink">知识库资产总览</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "论文语料", value: stats?.papers.total },
            { label: "会议 / 期刊", value: stats?.journals?.total },
            { label: "文献库条目", value: stats?.library.total },
            { label: "研究对话", value: stats?.conversations.total },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-line bg-panel px-4 py-3">
              <p className="text-xl font-bold tabular-nums text-ink">
                {s.value ?? "—"}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-faint">{s.label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ═══ Agent 设置(界面演示;编排引擎暂未读取偏好)═══ */

const AGENT_META: { id: string; name: string; duty: string }[] = [
  { id: "scout", name: "Scout", duty: "论文检索与精排" },
  { id: "librarian", name: "Librarian", duty: "研究图谱构建" },
  { id: "synthesis", name: "Synthesis", duty: "多源综合回答" },
  { id: "research_design", name: "Research Design", duty: "研究方案生成" },
  { id: "code_assistant", name: "Code Assistant", duty: "实验代码生成与复现" },
  { id: "writer", name: "Writer", duty: "综述与论文写作" },
  { id: "critic", name: "Critic", duty: "审稿与投稿匹配反馈" },
];

const MODEL_OPTIONS = ["API接入", "订阅"] as const;

/** 行内分段开关(两选项) */
function ModelPills({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-lg bg-chip p-0.5">
      {MODEL_OPTIONS.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={value === m}
          onClick={() => onChange(m)}
          className={cn(
            "cursor-pointer rounded-md px-2.5 py-1 text-[11px] transition-colors",
            value === m ? "bg-card font-medium text-primary shadow-sm" : "text-muted",
          )}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

function AgentToggle({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? "停用该 Agent" : "启用该 Agent"}
      onClick={onToggle}
      className={cn(
        "relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors",
        on ? "bg-primary" : "bg-line",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-4 rounded-full bg-white shadow transition-all",
          on ? "left-[18px]" : "left-0.5",
        )}
      />
    </button>
  );
}

export function AgentPanel() {
  const agentDefaultModel = useDemoState((s) => s.agentDefaultModel);
  const setAgentDefaultModel = useDemoState((s) => s.setAgentDefaultModel);
  const agentPrefs = useDemoState((s) => s.agentPrefs);
  const setAgentPref = useDemoState((s) => s.setAgentPref);

  const enabledCount = AGENT_META.filter((a) => agentPrefs[a.id]?.enabled !== false).length;

  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-[15px] font-semibold text-ink">默认模型路由</h3>
        <div className="mt-3 flex items-center gap-3">
          <ModelPills value={agentDefaultModel} onChange={setAgentDefaultModel} />
          <span className="text-[11px] text-faint">
            未单独指定模型的 Agent 将使用该路由
          </span>
        </div>
      </section>

      <section>
        <h3 className="flex items-center justify-between text-[15px] font-semibold text-ink">
          智能体编排
          <span className="text-xs font-normal text-faint">
            已启用 {enabledCount}/{AGENT_META.length}
          </span>
        </h3>
        <div className="mt-3 space-y-2">
          {AGENT_META.map((agent) => {
            const pref = agentPrefs[agent.id] ?? { enabled: true, model: "API接入" };
            return (
              <div
                key={agent.id}
                className={cn(
                  "flex items-center gap-4 rounded-xl border border-line bg-panel px-4 py-3 transition-opacity",
                  !pref.enabled && "opacity-55",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    {agent.name}
                    <Sparkles className="size-3 text-primary" />
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">{agent.duty}</p>
                </div>
                <ModelPills
                  value={pref.model}
                  onChange={(model) => setAgentPref(agent.id, { model })}
                />
                <AgentToggle
                  on={pref.enabled}
                  onToggle={() => setAgentPref(agent.id, { enabled: !pref.enabled })}
                />
              </div>
            );
          })}
        </div>
        <p className="mt-3 flex items-center gap-1 text-[11px] text-faint">
          <Info className="size-3" />
          当前为界面演示；多智能体编排引擎暂未读取这些偏好
        </p>
      </section>
    </div>
  );
}

/* ═══ API Keys(本地演示,不校验)═══ */

/** 由名称生成演示密钥 */
function generateDemoKey(): string {
  const rand = () =>
    Array.from({ length: 12 }, () => Math.random().toString(36)[2] ?? "x").join("");
  return `sk-demo-${rand()}${rand()}`;
}

function maskKey(key: string): string {
  if (key.length <= 16) return `${key.slice(0, 8)}****`;
  return `${key.slice(0, 12)}********${key.slice(-4)}`;
}

export function ApiKeysPanel() {
  const apiKeys = useDemoState((s) => s.apiKeys);
  const addApiKey = useDemoState((s) => s.addApiKey);
  const removeApiKey = useDemoState((s) => s.removeApiKey);

  const [name, setName] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  /** 刚创建的完整密钥仅展示一次 */
  const [justCreated, setJustCreated] = React.useState<string | null>(null);

  const handleCreate = async () => {
    const finalName = name.trim() || "未命名密钥";
    const fullKey = generateDemoKey();
    addApiKey({
      id: `key-${Date.now().toString(36)}`,
      name: finalName,
      masked: maskKey(fullKey),
      createdAt: new Date().toISOString().slice(0, 10),
    });
    setName("");
    setCreating(false);
    setJustCreated(fullKey);
    toast.success("密钥已创建");
    await copyText(fullKey, "完整密钥已复制(请妥善保存)");
  };

  return (
    <div className="space-y-5">
      <section className="flex items-start gap-3 rounded-xl border border-line bg-panel p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-faint" />
        <p className="text-xs leading-relaxed text-muted">
          密钥用于通过 API 调用研枢能力。当前为<b>演示环境</b>,密钥仅保存在本机浏览器、不校验真伪;
          完整密钥仅在创建时展示一次,请立即复制保存。
        </p>
      </section>

      {/* 新建 */}
      {!creating ? (
        <Button size="sm" className="rounded-xl" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" />
          创建新密钥
        </Button>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-2 flex items-center gap-3 rounded-xl border border-line bg-card p-4 shadow-card duration-300">
          <Input
            placeholder="密钥名称(如:实验室服务器)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="max-w-sm"
            autoFocus
          />
          <Button size="sm" onClick={() => void handleCreate()}>
            生成
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCreating(false)}>
            取消
          </Button>
        </div>
      )}

      {/* 刚创建的完整密钥(仅展示一次) */}
      {justCreated && (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-2 rounded-xl border border-success/40 bg-success-soft p-4 duration-300">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-success">
            <Check className="size-3.5" />
            密钥已创建,请立即复制保存(关闭后将无法再次查看)
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-card px-3 py-2 font-mono text-xs text-ink">
              {justCreated}
            </code>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => void copyText(justCreated, "完整密钥已复制")}
            >
              <Copy className="size-3.5" />
              复制
            </Button>
          </div>
        </div>
      )}

      {/* 密钥列表 */}
      <section>
        <h3 className="text-[15px] font-semibold text-ink">我的密钥 · {apiKeys.length}</h3>
        <div className="mt-3 space-y-2">
          {apiKeys.map((key) => (
            <div
              key={key.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-card px-4 py-3"
            >
              <KeyRound className="size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{key.name}</p>
                <code className="block truncate font-mono text-[11px] text-faint">
                  {key.masked}
                </code>
              </div>
              <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-medium text-success">
                有效
              </span>
              <span className="hidden text-[11px] text-faint sm:block">
                创建于 {key.createdAt}
                {key.lastUsedAt && ` · 最后使用 ${key.lastUsedAt}`}
              </span>
              <button
                type="button"
                title="复制掩码标识"
                onClick={() => void copyText(key.masked, "已复制密钥标识")}
                className="cursor-pointer rounded-md p-1.5 text-faint transition-colors hover:bg-chip hover:text-primary"
              >
                <Copy className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={`删除 ${key.name}`}
                title="删除密钥"
                onClick={() => {
                  removeApiKey(key.id);
                  toast.info(`已删除「${key.name}」`);
                }}
                className="cursor-pointer rounded-md p-1.5 text-faint transition-colors hover:bg-chip hover:text-danger"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          {apiKeys.length === 0 && (
            <div className="rounded-xl bg-card p-8 text-center text-sm text-faint shadow-card">
              还没有密钥，点击上方「创建新密钥」开始
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
