# 深知品牌标识与配色设计规范

> 日期:2026-07-29 · 状态:已定稿并应用(v4:日/夜双版 Logo + 夜间模式)
> 定位:深知是面向人工智能领域学术科研的**专业可信知识智能体服务平台**,提供论文检索、投稿筛选,以及用于 Deep Research 与 Auto Research 的知识智能体服务。

---

## 一、品牌标识:「深知」书法成品(日/夜双版)

### 1.1 设计概念

- **书法「深知」竖排** —— 用户定稿的书法成品,铁画银钩、瘦劲挺拔,是中文书法里"学术与高级感"的巅峰符号。
- **日/夜双版反色** —— 日间版白字黑底(碑拓感),夜间版黑字白底(宣纸感);标识随界面主题整体反转,在两种底色上都保持同等辨识度。
- **成品直用** —— 两张 PNG 即最终版,不做二次合成(无印面改色、无裁切);前端仅以圆角裁切展示(rounded-[10px])。

### 1.2 资产

- 母版:`frontend_v1/brand/日间logo.png`(白字黑底)/ `frontend_v1/brand/夜间logo.png`(黑字白底),2048×2048
- 前端(frontend_v1/brand/,由 logo.tsx 静态导入打包):
  - `logo-day.png` 日间标识(母版直拷)
  - `logo-night.png` 夜间标识(母版直拷)
- favicon:`frontend_v1/app/icon.png`(日间版 256px,Next.js 约定)
- 复跑管线:`frontend_v1/brand/process_logo.py`(拷贝 + favicon 缩放,仅 Pillow)

### 1.3 使用规范

- 最小尺寸 16px(favicon);标识不叠加渐变/阴影/描边
- 侧边栏锁定组合:「36px 标识 + 深知 / ShenZhi · Research OS」
- 主题切换由 CSS 控制:日间图 `dark:hidden`,夜间图 `hidden dark:block`,无 JS 水合闪烁

---

## 二、品牌配色板「深识」体系 v4

四概念推导,辅助色仅用于功能语义场景,不进入标识本体:

| 色名 | 概念 | 日间色值 | 夜间色值 | 用途 |
|---|---|---|---|---|
| 深识蓝 | 知识 · 主色 | `#002FA7` | `#5B84F1`(调浅) | 主按钮、激活态、链接 |
| 深识蓝-雾 | 主色 soft | `#E9EEFB` | `#1E2A52` | 选中底、徽章底 |
| 灵犀紫 | 智能(加深) | `#5B21B6` | `#9F7AEA` | AI 功能标记、智能体标识 |
| 探索青 | 科研(加深) | `#155E75` | `#4FBDD9` | 数据、图表、进度 |
| 桂冠金 | 学术(明亮 golden) | `#f3d029` | `#f3d029`(不变) | 新标徽章、Pro 标识(金底配墨字) |
| 墨/主文字 | 文字 | `#0F1419` | `#E9EDF7` | 标题、正文 |
| 页面底 | 背景 | `#F7F8FC` | `#0B1020` | 页面背景 |
| 侧边栏 | 背景 | `#EEF1F8` | `#101731` | 全局侧边栏 |
| 卡片 | 背景 | `#FFFFFF` | `#161D36` | 卡片、顶栏 |
| 危险/成功 | 状态 | `#EF4444`/`#10B981` | `#F87171`/`#34D399` | 紧急、正常 |

**夜间模式原则**:主蓝调浅保证暗底对比度;桂冠金不变(暗底下依然醒目);所有页面结构色(背景/卡片/文字/边线)经令牌整体反转,组件零改动。

---

## 三、日/夜模式技术方案(frontend_v1)

1. **令牌反转**:`app/globals.css` 中 `@theme` 定义日间令牌;`.dark` 块重定义同名变量为夜间值。Tailwind 4 工具类引用 `var(--color-*)`,变量级联自动生效;`@custom-variant dark (&:where(.dark, .dark *))` 支持 `dark:` 工具类。
2. **首屏脚本**:`app/layout.tsx` 内联脚本在绘制前确定主题 —— `?theme=dark|light`(调试/分享)> `localStorage("shenzhi-theme")` > 系统偏好;设置 `html.dark`,`suppressHydrationWarning` 防告警。
3. **切换组件**:`components/layout/theme-toggle.tsx`(Sun/Moon),位于侧边栏 Logo 右侧与移动端顶栏;点击切换 class 并写 localStorage;挂载前渲染占位防水合不匹配。
4. **Logo 双图**:`components/layout/logo.tsx` 双 next/image,CSS `dark:` 显隐切换。
5. **硬编码收口**:琥珀/绿/紫徽章、推荐卡片、引用图表等少数 hex 色加 `dark:` 变体;`hover:bg-white/70` 等改为 `hover:bg-card`。

---

## 四、交付物

1. `frontend_v1/brand/logo-day.png` / `logo-night.png` — 日/夜标识(成品直用)
2. `frontend_v1/app/icon.png` — favicon
3. `frontend_v1/components/layout/logo.tsx` — 双主题 Logo
4. `frontend_v1/components/layout/theme-toggle.tsx` — 切换组件(侧边栏 + 移动顶栏)
5. `frontend_v1/app/layout.tsx` — 首屏主题脚本
6. `frontend_v1/app/globals.css` — 日间令牌 + `.dark` 夜间令牌
7. 金色点缀:侧边栏「新」徽章、AI 页 Pro 徽章 / Pro 模式星标
8. `frontend_v1/brand/` 目录:日/夜母版 PNG、process_logo.py、候选稿与验证截图(theme-*-day/night.png)

## 五、验证

- `pnpm build` 通过(8 路由 + `/icon.png`)
- 生产构建 headless Edge 截图:首页日/夜、AI 助手夜、投稿夜、学者夜(`?theme=dark` 触发;卡片淡入为截图时机伪影,SSR 内容完整)
- 日夜 Logo 在 36px 下均清晰可辨
