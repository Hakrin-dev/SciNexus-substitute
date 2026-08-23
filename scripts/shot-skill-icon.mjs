#!/usr/bin/env node
/**
 * 技能图标 + 设置页新 Tab 验证截图。
 * 必须由 **Windows 侧 node** 执行(C:\Program Files\nodejs\node.exe),
 * 脚本路径用 UNC:\\wsl.localhost\Ubuntu-24.04\home\hkr\projects\scinexus\scripts\shot-skill-icon.mjs
 */
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`;

const args = { width: 1440, height: 1000 };
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i]
    .replace(/^--/, "")
    .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  args[key] = process.argv[i + 1];
}
args.width = Number(args.width);
args.height = Number(args.height);
if (!args.url || !args.outDir) {
  console.error("missing --url / --out-dir");
  process.exit(2);
}

const profile = mkdtempSync(join(tmpdir(), "edge-skillicon-"));
const edge = spawn(
  EDGE,
  [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    `--user-data-dir=${profile}`,
    `--window-size=${args.width},${args.height}`,
    "--remote-debugging-pipe",
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] },
);
const toEdge = edge.stdio[3];
const fromEdge = edge.stdio[4];
edge.stderr.on("data", () => {});

let msgId = 0;
const pending = new Map();
let recvBuf = "";
fromEdge.on("data", (chunk) => {
  recvBuf += chunk.toString("utf8");
  let idx;
  while ((idx = recvBuf.indexOf("\0")) >= 0) {
    const raw = recvBuf.slice(0, idx);
    recvBuf = recvBuf.slice(idx + 1);
    if (!raw) continue;
    const msg = JSON.parse(raw);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});
function cdp(method, params = {}, sessionId) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, (msg) =>
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result),
    );
    toEdge.write(JSON.stringify({ id, method, params, sessionId }) + "\0");
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { targetId } = await cdp("Target.createTarget", { url: args.url });
const { sessionId } = await cdp("Target.attachToTarget", { targetId, flatten: true });
await cdp("Page.enable", {}, sessionId);
await cdp(
  "Emulation.setDeviceMetricsOverride",
  { width: args.width, height: args.height, deviceScaleFactor: 1, mobile: false },
  sessionId,
);

async function evalJs(expression) {
  const { result } = await cdp(
    "Runtime.evaluate",
    { expression, returnByValue: true },
    sessionId,
  );
  return result.value;
}

async function waitText(text, timeout = 45000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evalJs(`document.body ? document.body.innerText.includes(${JSON.stringify(text)}) : false`))
      return true;
    await sleep(250);
  }
  console.error(`WARN: 等待文本「${text}」超时`);
  return false;
}

async function shot(name) {
  const data = await cdp(
    "Page.captureScreenshot",
    { format: "png", captureBeyondViewport: false },
    sessionId,
  );
  writeFileSync(join(args.outDir, name), Buffer.from(data.data, "base64"));
  console.log("shot:", name);
}

// ① 对话页:点「+」展开 插件/技能/联网搜索 菜单
await waitText("有什么我可以帮你研究的");
await sleep(600);
console.log(
  "click +:",
  await evalJs(`(() => {
    const b = document.querySelector('button[aria-label="更多操作"]');
    if (!b) return false;
    b.click();
    return true;
  })()`),
);
await sleep(400);
await shot("g_skill_1_plusmenu.png");

// ② 设置页:Tab 栏应含 MCP Server / Plugin Market / Skills Bank
await cdp("Page.navigate", { url: args.url.replace(/\/[^/]*$/, "/settings") }, sessionId);
await waitText("Skills Bank");
await sleep(600);
await shot("g_skill_2_settings.png");

// ③ 悬停侧边栏「设置」→ 弹出悬浮菜单(需侧边栏未折叠;若折叠则先点展开)
const center = await evalJs(`(() => {
  const els = [...document.querySelectorAll("a,button")];
  const el = els.find((x) => x.innerText.trim() === "设置" && x.offsetParent !== null);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);
console.log("hover 设置 at:", JSON.stringify(center));
if (center) {
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: center.x, y: center.y, buttons: 0 }, sessionId);
}
await sleep(500);
await shot("g_skill_3_menu.png");

edge.kill();
setTimeout(() => {
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
  } catch {}
  console.log("done");
  process.exit(0);
}, 500);
