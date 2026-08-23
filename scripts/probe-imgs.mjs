#!/usr/bin/env node
/** 探针:打印 /agents 页面面板内所有 img 的 src 与加载状态(naturalWidth=0 即加载失败) */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`;
const profile = mkdtempSync(join(tmpdir(), "edge-probe-"));
const edge = spawn(
  EDGE,
  ["--headless", "--disable-gpu", "--no-first-run", `--user-data-dir=${profile}`,
   "--window-size=1440,1000", "--remote-debugging-pipe", "about:blank"],
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

const { targetId } = await cdp("Target.createTarget", { url: process.argv[2] });
const { sessionId } = await cdp("Target.attachToTarget", { targetId, flatten: true });
await cdp("Page.enable", {}, sessionId);

async function evalJs(expression, awaitPromise = false) {
  const { result } = await cdp(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise },
    sessionId,
  );
  return result.value;
}

// 等页面就绪 → 打开模型面板 → 展开厂商列表
const deadline = Date.now() + 45000;
while (Date.now() < deadline) {
  if (await evalJs(`document.body ? document.body.innerText.includes("有什么我可以帮你研究的") : false`)) break;
  await sleep(250);
}
await sleep(800);
await evalJs(`[...document.querySelectorAll("button")].find((x) => x.innerText.trim() === "GPT-5.6 Sol")?.click()`);
await sleep(400);
await evalJs(`[...document.querySelectorAll("button")].find((x) => x.innerText.includes("模型") && x.innerText.includes("GPT-5.6"))?.click()`);
await sleep(600);

console.log(await evalJs(`[...document.querySelectorAll("img")].map((i) =>
  (i.alt || "?") + " | natural=" + i.naturalWidth + "x" + i.naturalHeight +
  " | box=" + i.getBoundingClientRect().width + "x" + i.getBoundingClientRect().height +
  " | " + i.src.slice(0, 110)).join("\\n")`));

edge.kill();
setTimeout(() => {
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch {}
  process.exit(0);
}, 500);
