#!/usr/bin/env node
/**
 * 模型选择面板交互验证截图 —— 按脚本序列点击/悬停并分步截图。
 *
 * 必须由 **Windows 侧 node** 执行(C:\Program Files\nodejs\node.exe),
 * 脚本路径用 UNC:\\wsl.localhost\Ubuntu-24.04\home\hkr\projects\scinexus\scripts\shot-composer.mjs
 * 传输走 --remote-debugging-pipe(见 shot-cdp.mjs 头注)。
 *
 * 用法:
 *   node.exe shot-composer.mjs --url http://localhost:3100/agents --out-dir "C:\Users\xxx\AppData\Local\Temp"
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

const profile = mkdtempSync(join(tmpdir(), "edge-composer-"));
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

/** 等待页面出现指定文本(真实时间轮询) */
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

/**
 * 点击「文本完全匹配」的按钮;exact=false 时退化为 includes。
 * 返回是否点到。
 */
async function clickButton(text, exact = true) {
  return evalJs(`(() => {
    const t = ${JSON.stringify(text)};
    const btns = [...document.querySelectorAll("button")];
    const b = btns.find((x) =>
      (${exact} ? x.innerText.trim() === t : x.innerText.includes(t)) &&
      x.offsetParent !== null);
    if (!b) return false;
    b.click();
    return true;
  })()`);
}

/** 取「文本完全匹配」元素的中心坐标(供 CDP 悬停) */
async function rectCenter(text) {
  return evalJs(`(() => {
    const t = ${JSON.stringify(text)};
    const el = [...document.querySelectorAll("button")].find(
      (x) => x.innerText.trim() === t && x.offsetParent !== null);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
}

async function hoverAt(x, y) {
  await cdp(
    "Input.dispatchMouseEvent",
    { type: "mouseMoved", x, y, buttons: 0 },
    sessionId,
  );
}

async function shot(name) {
  const data = await cdp(
    "Page.captureScreenshot",
    { format: "png", captureBeyondViewport: false },
    sessionId,
  );
  const out = join(args.outDir, name);
  writeFileSync(out, Buffer.from(data.data, "base64"));
  console.log("shot:", name);
}

await waitText("有什么我可以帮你研究的");
await sleep(600);
await shot("f_comp_1_idle.png");

// ① 点开模型选择面板(触发钮显示 logo + 具体型号)
console.log("click trigger:", await clickButton("GPT-5.6 Sol"));
await sleep(400);
await shot("f_comp_2_panel.png");

// ② 点击「模型」行 → 向下展开厂商列表(行内同时含当前型号名,避免误点历史对话)
console.log(
  "click 模型 row:",
  await evalJs(`(() => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      x.innerText.includes("模型") && x.innerText.includes("GPT-5.6") &&
      x.offsetParent !== null);
    if (!b) return false;
    b.click();
    return true;
  })()`),
);
await sleep(400);
await shot("f_comp_3_providers.png");

// ③ 悬停 ChatGPT 厂商行 → 向右展开具体型号
const center = await rectCenter("ChatGPT");
console.log("hover ChatGPT at:", JSON.stringify(center));
if (center) await hoverAt(center.x, center.y);
await sleep(500);
await shot("f_comp_4_models.png");

// ④ 点击具体型号 GPT-5.5 Pro → 面板关闭,触发钮更新
console.log("click GPT-5.5 Pro:", await clickButton("GPT-5.5 Pro"));
await sleep(400);
await shot("f_comp_5_selected.png");

// ⑤ 重新打开,点「风格」→ 选「严谨质疑」(行标签改为所选风格)
console.log("click trigger:", await clickButton("GPT-5.5 Pro"));
await sleep(300);
console.log("click 风格 row:", await clickButton("风格"));
await sleep(300);
console.log("click 严谨质疑:", await clickButton("严谨质疑"));
await sleep(300);
await shot("f_comp_6_style.png");

// ⑥ 点「深度」模式(原子核;未选中态仅图标无文字,按 aria-label 定位)
console.log(
  "click 深度:",
  await evalJs(`(() => {
    const b = document.querySelector('button[aria-label="深度"]');
    if (!b) return false;
    b.click();
    return true;
  })()`),
);
await sleep(400);
await shot("f_comp_7_deep.png");

edge.kill();
setTimeout(() => {
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
  } catch {}
  console.log("done");
  process.exit(0);
}, 500);
