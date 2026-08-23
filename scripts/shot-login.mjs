#!/usr/bin/env node
/** 验证:模型面板新 Gemini 星标;登录弹窗「免密登录」tab 的分割线 + GitHub/Google 按钮 */
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

const profile = mkdtempSync(join(tmpdir(), "edge-login-"));
const edge = spawn(
  EDGE,
  ["--headless", "--disable-gpu", "--no-first-run", `--user-data-dir=${profile}`,
   `--window-size=${args.width},${args.height}`, "--remote-debugging-pipe", "about:blank"],
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
async function clickButton(text) {
  return evalJs(`(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => x.innerText.trim().includes(${JSON.stringify(text)}) && x.offsetParent !== null);
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

await waitText("有什么我可以帮你研究的");
await sleep(600);

// ① 模型面板:Gemini 应为星形标
await clickButton("GPT-5.6 Sol");
await sleep(400);
await evalJs(`[...document.querySelectorAll("button")].find((x) => x.innerText.includes("模型") && x.innerText.includes("GPT-5.6"))?.click()`);
await sleep(600);
await shot("f_gem_1_providers.png");

// 关掉面板(按 Escape),打开登录弹窗
await evalJs(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));`);
await sleep(300);
console.log("open login:", await clickButton("未登录"));
await sleep(600);
await shot("f_gem_2_login_password.png");

// ② 免密登录 tab
console.log("click 免密登录:", await clickButton("免密登录"));
await sleep(500);
await shot("f_gem_3_login_passwordless.png");

edge.kill();
setTimeout(() => {
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch {}
  console.log("done");
  process.exit(0);
}, 500);
