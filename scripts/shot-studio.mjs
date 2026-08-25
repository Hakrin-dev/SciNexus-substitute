#!/usr/bin/env node
/**
 * 工作台 AI 生成工作台 + 助手栏折叠 交互验证截图(一次性脚本)。
 * 必须由 Windows 侧 node 执行(UNC 路径引用),CDP 管线同 shot-composer.mjs。
 *
 * 用法:
 *   node.exe shot-studio.mjs --url "http://localhost:3100/projects/scinexus?view=thread" --out-dir "C:\Users\hankairun\AppData\Local\Temp\wbshot"
 */
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`;

const args = { width: 1680, height: 1500 };
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i].replace(/^--/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  args[key] = process.argv[i + 1];
}
if (!args.url || !args.outDir) {
  console.error("missing --url / --out-dir");
  process.exit(2);
}

const profile = mkdtempSync(join(tmpdir(), "edge-studio-"));
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
    pending.set(id, (msg) => (msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)));
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
  const { result } = await cdp("Runtime.evaluate", { expression, returnByValue: true }, sessionId);
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
async function clickButton(text, exact = false) {
  return evalJs(`(() => {
    const t = ${JSON.stringify(text)};
    const b = [...document.querySelectorAll("button")].find((x) =>
      (${exact} ? x.innerText.trim() === t : x.innerText.includes(t)) && x.offsetParent !== null);
    if (!b) return false;
    b.click();
    return true;
  })()`);
}
async function clickAria(label) {
  return evalJs(`(() => {
    const b = document.querySelector('[aria-label="${label}"]');
    if (!b) return false;
    b.click();
    return true;
  })()`);
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

// ① 助手栏底部「AI 生成」→ 进入中间栏 studio
await waitText("AI 建议");
console.log("click AI 生成:", await clickButton("AI 生成"));
await waitText("开始生成");
await sleep(500);
await shot("wb3_studio_select.png");

// ② 选「组会PPT」→ 开始生成 → 等编辑器出现
console.log("click 组会PPT:", await clickButton("组会PPT"));
await sleep(300);
await shot("wb3_studio_slides.png");
console.log("click 开始生成:", await clickButton("开始生成"));
await waitText("可直接编辑");
await sleep(500);
await shot("wb3_studio_editor.png");

// ③ 收起助手栏 → 中间栏占满
console.log("click 收起:", await clickAria("收起 AI 助手栏"));
await sleep(500);
await shot("wb3_panel_collapsed.png");

// ④ 重新展开
console.log("click 展开:", await clickAria("展开 AI 助手栏"));
await sleep(500);
await shot("wb3_panel_reopened.png");

edge.kill();
process.exit(0);
