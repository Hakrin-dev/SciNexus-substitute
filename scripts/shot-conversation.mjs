#!/usr/bin/env node
/**
 * AI 对话态验证:发送消息进入对话界面后——
 * 输入框右上的进度条+上下文圆环、菜单向上展开、圆环点击 compact、提示语上滑轮换。
 * 必须由 **Windows 侧 node** 执行(见 shot-cdp.mjs 头注)。
 *
 * 用法:
 *   node.exe shot-conversation.mjs --url http://localhost:3000/agents --out-dir "C:\Users\xxx\AppData\Local\Temp"
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

const profile = mkdtempSync(join(tmpdir(), "edge-conv-"));
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

async function evalJs(expression, awaitPromise = false) {
  const { result } = await cdp(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise },
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

await waitText("有什么我可以帮你研究的");
await sleep(600);

// 发送一条消息(快速模式,无 FastAPI 时回退 MOCK_REPLY,仍进入对话态)
await evalJs(`(() => {
  const ta = document.querySelector("textarea");
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, "value").set;
  setter.call(ta, "扩散模型在机器人控制中的最新进展");
  ta.dispatchEvent(new Event("input", { bubbles: true }));
  ta.dispatchEvent(new KeyboardEvent("keydown",
    { key: "Enter", bubbles: true }));
  return true;
})()`);

await waitText("研枢", 20000); // 任意应答出现
await waitText("已回退本地演示模式", 25000).catch?.(() => {});
await sleep(1200);
await shot("f_conv_1_meters.png");

// 仪表读数
console.log(
  "meters:",
  await evalJs(`(() => {
    const bar = document.querySelector('[role="progressbar"]');
    const ring = document.querySelector('button[aria-label="压缩上下文"]');
    return JSON.stringify({
      progress: bar ? bar.getAttribute("aria-valuenow") : null,
      ringTitle: ring ? ring.getAttribute("title") : null,
    });
  })()`),
);

// 对话态:模型面板应向上展开
await evalJs(`[...document.querySelectorAll("button")].find((x) => x.innerText.trim() === "GPT-5.6 Sol")?.click()`);
await sleep(500);
await shot("f_conv_2_panel_up.png");

// 展开厂商列表(面板内容向上生长)
await evalJs(`[...document.querySelectorAll("button")].find((x) => x.innerText.includes("模型") && x.innerText.includes("GPT-5.6"))?.click()`);
await sleep(500);
await shot("f_conv_3_providers_up.png");

// 点击圆环 compact(不应报错/崩坏)
console.log(
  "click ring:",
  await evalJs(`(() => {
    const b = document.querySelector('button[aria-label="压缩上下文"]');
    if (!b) return false;
    b.click();
    return true;
  })()`),
);
await sleep(400);

// 提示语轮换:隔一个周期再拍,两句应不同
await shot("f_conv_4_hint_a.png");
await sleep(4600);
await shot("f_conv_5_hint_b.png");

edge.kill();
setTimeout(() => {
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch {}
  console.log("done");
  process.exit(0);
}, 500);
