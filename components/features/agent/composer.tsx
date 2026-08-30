"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image, { type StaticImageData } from "next/image";
import {
  ArrowUp,
  Atom,
  Check,
  ChevronDown,
  ChevronRight,
  Globe,
  KeyRound,
  Plug,
  Plus,
  Zap,
} from "lucide-react";
import { SkillScroll } from "@/components/icons/skill-scroll";
import chatgptLogo from "@/brand/LOGO/ChatGPT.svg";
import deepseekLogo from "@/brand/LOGO/DeepSeek.png";
import grokLogo from "@/brand/LOGO/Grok.svg";
import glmLogo from "@/brand/LOGO/GLM.svg";
import geminiLogo from "@/brand/LOGO/Gemini.svg";
import kimiLogo from "@/brand/LOGO/Kimi.png";
import qwenLogo from "@/brand/LOGO/Qwen.svg";
import { cn } from "@/lib/utils";
import { AttachmentMenu } from "./attachment-menu";

/** 回答模式:快速(闪电)/ 深度(原子核) */
export const MODES = [
  { value: "fast", label: "快速", icon: Zap },
  { value: "deep", label: "深度", icon: Atom },
] as const;
export type ComposerMode = (typeof MODES)[number]["value"];

/** 回答风格(透传后端 system 提示词) */
export const STYLES = ["头脑风暴", "简明扼要", "全面细致", "严谨质疑"] as const;
export type StyleChoice = (typeof STYLES)[number];

/**
 * 模型厂商与具体型号(演示数据;实际模型名由后端环境变量路由)。
 * 首两行为真实路由:「API Key」(API接入)与「订阅模型」(订阅),其余为品牌预览。
 * logo 为 brand/LOGO 下的品牌标识;logoClass 做逐个大小适配
 * (各源文件留白/出血不一致,如 Qwen 有效内容仅占画布约 54%,需放大)。
 */
export const PROVIDERS: {
  name: string;
  logo?: string | StaticImageData;
  /** 路由类条目(API Key)使用 lucide 图标而非品牌 logo */
  icon?: typeof Zap;
  logoClass?: string;
  /** 源文件满出血背景、图形居中且占比小(如 Grok): overflow 裁剪 + 放大突出中间图形 */
  logoZoom?: boolean;
  models: readonly string[];
}[] = [
  {
    name: "API Key",
    icon: KeyRound,
    models: ["API接入"],
  },
  {
    name: "ChatGPT",
    logo: chatgptLogo,
    models: ["GPT-5.6 Sol", "GPT-5.6 Terra", "GPT-5.6 Luna", "GPT-5.5", "GPT-5.5 Pro"],
  },
  {
    name: "DeepSeek",
    logo: deepseekLogo,
    logoClass: "scale-110",
    models: ["DeepSeek-V4", "DeepSeek-V4 Pro", "DeepSeek-R3"],
  },
  {
    name: "Gemini",
    logo: geminiLogo,
    models: ["Gemini 3.5 Pro", "Gemini 3.5 Flash", "Gemini 3.0"],
  },
  {
    name: "GLM",
    logo: glmLogo,
    models: ["GLM-5", "GLM-5 Air", "GLM-4.6"],
  },
  {
    name: "Grok",
    logo: grokLogo,
    models: ["Grok 5", "Grok 5 Heavy", "Grok 4.2"],
  },
  {
    name: "Kimi",
    logo: kimiLogo,
    logoClass: "rounded-[3px]",
    models: ["Kimi K3", "Kimi K3 Thinking", "Kimi K2.5"],
  },
  {
    name: "Qwen",
    logo: qwenLogo,
    logoClass: "scale-[1.85]",
    models: ["Qwen4-Max", "Qwen4-Plus", "Qwen4-Turbo"],
  },
];

export const DEFAULT_MODEL: string = PROVIDERS[0].models[0];

/** 模型选择:具体模型名(演示);后端按环境变量路由到实际模型 */
export type ModelChoice = string;

/** 按具体模型名反查厂商(未识别时回退到第一个厂商) */
function providerOf(model: string) {
  return (
    PROVIDERS.find((p) => p.models.includes(model)) ?? PROVIDERS[0]
  );
}

/** 厂商 logo:固定 16px 框内 object-contain,按厂商微调缩放/圆角;logoZoom 时裁剪放大突出中间图形 */
function ProviderLogo({
  provider,
}: {
  provider: (typeof PROVIDERS)[number];
}) {
  if (provider.icon) {
    const Icon = provider.icon;
    return (
      <span className="flex size-4 shrink-0 items-center justify-center">
        <Icon className="size-3.5 shrink-0 text-primary" strokeWidth={1.8} />
      </span>
    );
  }
  if (!provider.logo) return null;
  const img = (
    <Image
      src={provider.logo}
      alt={provider.name}
      width={16}
      height={16}
      className={cn("size-4 shrink-0 object-contain", provider.logoClass)}
    />
  );
  if (provider.logoZoom) {
    return (
      <span className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-[3px]">
        {img}
      </span>
    );
  }
  return img;
}

function useCloseOnOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

/** 「+」菜单:插件 / 技能(演示)与联网搜索(可开关,启用时高亮) */
function PlusMenu({ placement = "down" }: { placement?: "up" | "down" }) {
  const [open, setOpen] = useState(false);
  const [webSearchOn, setWebSearchOn] = useState(false);
  const ref = useCloseOnOutside(open, () => setOpen(false));

  const ITEMS = [
    { label: "插件", icon: Plug, href: "/tools/plugins" },
    { label: "技能", icon: SkillScroll, href: "/tools/skills" },
  ];

  return (
    <div ref={ref} className="relative">
      {/* 启用联网搜索时,「+」钮本身常亮提示 */}
      <button
        type="button"
        aria-label="更多操作"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex size-9 cursor-pointer items-center justify-center rounded-xl transition-colors",
          open || webSearchOn ? "bg-chip text-ink" : "text-muted hover:bg-chip",
        )}
      >
        <Plus
          className={cn("size-5 transition-transform", open && "rotate-45")}
        />
      </button>
      {open && (
        <div
          className={cn(
            "absolute left-0 z-50 w-40 rounded-xl border border-line bg-card p-1.5 shadow-pop",
            placement === "down" ? "top-full mt-2" : "bottom-full mb-2",
          )}
        >
          {ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              title={`管理${item.label}`}
              onClick={() => setOpen(false)}
              className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm text-ink-2 transition-colors hover:bg-chip"
            >
              <item.icon className="size-4 text-muted" strokeWidth={1.8} />
              {item.label}
            </a>
          ))}
          {/* 联网搜索:点击切换启用/关闭,启用时背景变亮 */}
          <button
            type="button"
            role="switch"
            aria-checked={webSearchOn}
            onClick={() => setWebSearchOn((v) => !v)}
            className={cn(
              "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
              webSearchOn
                ? "bg-primary-soft font-medium text-primary"
                : "text-ink-2 hover:bg-chip",
            )}
          >
            <Globe
              className={cn(
                "size-4",
                webSearchOn ? "text-primary" : "text-muted",
              )}
              strokeWidth={1.8}
            />
            联网搜索
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 模型选择面板(演示):触发钮显示已选模型 logo + 具体名称;
 * 点击展开三行——
 *  模型:点击向下展开厂商列表,悬停厂商向右展开具体型号,选中后关闭面板;
 *  风格:点击向下展开风格选项,选中后行标签改为所选风格名;
 *  模式:左「快速」右「深度」分段开关——选中项伸展占满剩余空间
 *       (图标+文字),未选中项收缩为仅图标。
 */
function ModelPicker({
  placement = "down",
  model,
  onModelChange,
  style,
  onStyleChange,
  mode,
  onModeChange,
}: {
  placement?: "up" | "down";
  model: ModelChoice;
  onModelChange: (m: ModelChoice) => void;
  style: StyleChoice | null;
  onStyleChange: (s: StyleChoice) => void;
  mode: ComposerMode;
  onModeChange: (v: ComposerMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<"model" | "style" | null>(null);
  const ref = useCloseOnOutside(open, () => setOpen(false));
  const provider = providerOf(model);
  /** 厂商型号飞出面板:当前悬停厂商 + 面板 fixed 定位坐标 */
  const [openProv, setOpenProv] = useState<string | null>(null);
  const [provPos, setProvPos] = useState<{ top: number; left: number } | null>(null);
  const provCloseTimer = useRef<number | undefined>(undefined);

  const toggle = (s: "model" | "style") => {
    setSection((cur) => {
      if (cur !== s) setOpenProv(null);
      return cur === s ? null : s;
    });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          setOpenProv(null);
        }}
        className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-primary bg-transparent px-3 text-[13px] text-ink-2 transition-colors hover:bg-primary-soft hover:text-ink"
      >
        <ProviderLogo provider={provider} />
        <span className="max-w-36 truncate">{model}</span>
        <ChevronDown
          className={cn(
            "size-3.5 text-faint transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 z-50 w-64 rounded-xl border border-line bg-card p-1.5 shadow-pop",
            placement === "down" ? "top-full mt-2" : "bottom-full mb-2",
          )}
        >
          {/* 模型:点击向下展开厂商,悬停厂商向右展开具体型号 */}
          <button
            type="button"
            aria-expanded={section === "model"}
            onClick={() => toggle("model")}
            className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-sm text-ink-2 transition-colors hover:bg-chip"
          >
            <span className="flex-1 text-left">模型</span>
            <span className="max-w-28 truncate text-xs text-faint">{model}</span>
            {section === "model" ? (
              <ChevronDown className="size-3.5 shrink-0 text-faint" />
            ) : (
              <ChevronRight className="size-3.5 shrink-0 text-faint" />
            )}
          </button>
          {section === "model" && (
            <div
              className="mb-1 ml-1.5 max-h-[180px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              onMouseLeave={() => {
                // 延迟关闭,给鼠标移入右侧型号面板留出间隙
                provCloseTimer.current = window.setTimeout(() => setOpenProv(null), 120);
              }}
              onMouseEnter={() => window.clearTimeout(provCloseTimer.current)}
              onScroll={() => setOpenProv(null)}
            >
              {PROVIDERS.map((p) => (
                <div key={p.name}>
                  <button
                    type="button"
                    className={cn(
                      "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 text-[13px] transition-colors",
                      openProv === p.name
                        ? "bg-chip text-ink"
                        : "text-ink-2 hover:bg-chip",
                    )}
                    onMouseEnter={(e) => {
                      window.clearTimeout(provCloseTimer.current);
                      const r = e.currentTarget.getBoundingClientRect();
                      setOpenProv(p.name);
                      setProvPos({ top: r.top, left: r.right + 6 });
                    }}
                  >
                    <ProviderLogo provider={p} />
                    <span className="flex-1 text-left">{p.name}</span>
                    <ChevronRight className="size-3.5 text-faint" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 悬停厂商的型号面板:fixed 定位,不受列表滚动裁剪影响 */}
          {section === "model" && openProv && provPos && (
            <div
              className="fixed z-50"
              style={{ top: provPos.top, left: provPos.left }}
              onMouseEnter={() => window.clearTimeout(provCloseTimer.current)}
              onMouseLeave={() => {
                provCloseTimer.current = window.setTimeout(() => setOpenProv(null), 120);
              }}
            >
              <div className="w-44 rounded-xl border border-line bg-card p-1 shadow-pop">
                {PROVIDERS.find((p) => p.name === openProv)?.models.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      onModelChange(m);
                      setSection(null);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-xs transition-colors",
                      m === model
                        ? "bg-primary-soft font-medium text-primary"
                        : "text-ink-2 hover:bg-chip",
                    )}
                  >
                    <span className="flex-1 truncate text-left">{m}</span>
                    {m === model && <Check className="size-3.5 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 风格:点击向下展开;选中后行标签改为所选风格名 */}
          <button
            type="button"
            aria-expanded={section === "style"}
            onClick={() => toggle("style")}
            className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-sm text-ink-2 transition-colors hover:bg-chip"
          >
            <span className="flex-1 text-left">{style ?? "风格"}</span>
            {section === "style" ? (
              <ChevronDown className="size-3.5 shrink-0 text-faint" />
            ) : (
              <ChevronRight className="size-3.5 shrink-0 text-faint" />
            )}
          </button>
          {section === "style" && (
            <div className="mb-1 ml-1.5">
              {STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    onStyleChange(s);
                    setSection(null);
                  }}
                  className={cn(
                    "flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-[13px] transition-colors",
                    s === style
                      ? "bg-primary-soft font-medium text-primary"
                      : "text-ink-2 hover:bg-chip",
                  )}
                >
                  <span className="flex-1 text-left">{s}</span>
                  {s === style && <Check className="size-3.5 shrink-0" />}
                </button>
              ))}
            </div>
          )}

          {/* 模式:左「快速」右「深度」;选中项伸展占满(图标+文字),未选中仅图标 */}
          <div className="flex h-9 items-center gap-1 px-1.5">
            {MODES.map((m) => {
              const active = mode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  aria-label={m.label}
                  aria-pressed={active}
                  onClick={() => onModeChange(m.value)}
                  className={cn(
                    "flex h-7 cursor-pointer items-center overflow-hidden whitespace-nowrap rounded-lg text-xs transition-all duration-200",
                    active
                      ? "flex-1 justify-center gap-1 bg-primary-soft px-2 font-medium text-primary"
                      : "w-7 shrink-0 justify-center text-muted hover:bg-chip",
                  )}
                >
                  <m.icon className="size-3.5 shrink-0" strokeWidth={1.8} />
                  {active && m.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** 发送键左侧轮换显示的快捷键提示(上滑:新句自下方入,旧句向上方出) */
const SHORTCUT_HINTS = [
  "Alt + Enter 搜索论文",
  "使用 @ 唤起引用",
  "Shift + Enter 换行",
  "使用 / 唤起插件或技能",
] as const;

/** 轮换间隔(ms) */
const HINT_INTERVAL = 3000;

/**
 * 加高版提问框(演示):
 * 左下为「+」、别针(引用菜单)与模型选择(模型/风格/模式);
 * 右下为快捷键提示(发送键左侧,上滑轮换)+ 圆形发送键(常亮)。
 * headerRight:对话态下挂在输入框右上方的仪表(任务进度条 + 上下文圆环)。
 */
export function ComposerShell({
  value,
  onChange,
  onSend,
  placeholder,
  menuPlacement = "down",
  mode,
  onModeChange,
  model,
  onModelChange,
  style,
  onStyleChange,
  onSearchPapers,
  headerRight,
  sendLeft,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder: string;
  menuPlacement?: "up" | "down";
  mode?: ComposerMode;
  onModeChange?: (v: ComposerMode) => void;
  model?: ModelChoice;
  onModelChange?: (model: ModelChoice) => void;
  style?: StyleChoice | null;
  onStyleChange?: (s: StyleChoice) => void;
  /** Alt+Enter:检索论文(各页面自行决定结果呈现方式) */
  onSearchPapers?: () => void;
  /** 输入框右上方挂载的附加内容(如 compact 圆环) */
  headerRight?: ReactNode;
  /** 发送键左侧挂载的附加内容(如任务进度条) */
  sendLeft?: ReactNode;
}) {
  const [internalMode, setInternalMode] = useState<ComposerMode>("fast");
  const [internalModel, setInternalModel] =
    useState<ModelChoice>(DEFAULT_MODEL);
  const [internalStyle, setInternalStyle] = useState<StyleChoice | null>(null);
  const [hintIndex, setHintIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setHintIndex((i) => (i + 1) % SHORTCUT_HINTS.length),
      HINT_INTERVAL,
    );
    return () => clearInterval(timer);
  }, []);

  const modeValue = mode ?? internalMode;
  const modelValue = model ?? internalModel;
  const styleValue = style === undefined ? internalStyle : style;

  /** 对话态(吸底)且未输入时,快捷键提示移入输入框内占位位置 */
  const hintsInline = menuPlacement === "up" && !value;

  /** 输入框随内容增高(上限 220px,超出不再增长);不使用内部滚动 */
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  return (
    <div className="rounded-2xl bg-card p-3 shadow-pop">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // Alt+Enter:检索论文
            if (e.key === "Enter" && e.altKey) {
              e.preventDefault();
              onSearchPapers?.();
              return;
            }
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={hintsInline ? "" : placeholder}
          rows={2}
          className={cn(
            "max-h-[220px] min-h-[72px] w-full resize-none overflow-y-auto bg-transparent px-1.5 pt-1 text-sm leading-relaxed text-ink outline-none placeholder:text-faint",
            headerRight && "pr-40",
          )}
        />
        {/* 对话态空输入:提示轮播占位于原 placeholder 位置 */}
        {hintsInline && (
          <span
            key={`inline-${hintIndex}`}
            aria-hidden
            className="pointer-events-none absolute left-1.5 top-2 select-none animate-[hint-slide-in_0.45s_ease_both] text-sm leading-relaxed text-faint"
          >
            {SHORTCUT_HINTS[hintIndex]}
          </span>
        )}
        {/* 右上:对话态仪表(任务进度 + 上下文占比) */}
        {headerRight && (
          <div className="absolute right-1 top-1">{headerRight}</div>
        )}
      </div>

      <div className="mt-1 flex items-center gap-1.5">
        {/* 左下:+(插件/技能/联网搜索)、别针(上传/引用)与模型选择 */}
        <PlusMenu placement={menuPlacement} />
        <AttachmentMenu
          placement={menuPlacement}
          onInsert={(token) =>
            onChange(`${value}${value && !value.endsWith(" ") ? " " : ""}${token} `)
          }
        />
        <ModelPicker
          placement={menuPlacement}
          model={modelValue}
          onModelChange={onModelChange ?? setInternalModel}
          style={styleValue}
          onStyleChange={onStyleChange ?? setInternalStyle}
          mode={modeValue}
          onModeChange={onModeChange ?? setInternalMode}
        />

        {/* 右下:快捷键提示轮换(对话态空输入时已移入框内)+ 圆形发送键(常亮) */}
        <div className="ml-auto flex items-center gap-2">
          {!hintsInline && (
            <span className="relative h-4 w-[124px] shrink-0 select-none overflow-hidden text-right">
              <span
                key={`out-${hintIndex}`}
                aria-hidden
                className="absolute inset-0 animate-[hint-slide-out_0.45s_ease_both] text-[11px] leading-4 text-faint"
              >
                {
                  SHORTCUT_HINTS[
                    (hintIndex + SHORTCUT_HINTS.length - 1) % SHORTCUT_HINTS.length
                  ]
                }
              </span>
              <span
                key={`in-${hintIndex}`}
                className="absolute inset-0 animate-[hint-slide-in_0.45s_ease_both] text-[11px] leading-4 text-faint"
              >
                {SHORTCUT_HINTS[hintIndex]}
              </span>
            </span>
          )}
          {sendLeft}
          <button
            type="button"
            aria-label="发送"
            onClick={onSend}
            className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary/90"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
