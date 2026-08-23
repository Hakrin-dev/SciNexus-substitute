#!/usr/bin/env node
/** 探针:采样发送键旁提示语,验证上滑轮换(两次采样应不同;动画后旧句应透明) */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`;
const profile = mkdtempSync(join(tmpdir(), "edge-hint-"));
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

async function evalJs(expression) {
  const { result } = await cdp(
    "Runtime.evaluate",
    { expression, returnByValue: true },
    sessionId,
  );
  return result.value;
}

const SAMPLE = `(() => {
  const spans = [...document.querySelectorAll("span")].filter(
    (s) => s.textContent.includes("Enter") && s.className.includes("absolute"));
  return spans.map((s) => {
    const cs = getComputedStyle(s);
    return (s.getAttribute("aria-hidden") ? "OUT" : "IN") +
      " [" + s.textContent + "] opacity=" + cs.opacity +
      " anim=" + cs.animationName;
  }).join(" | ");
})()`;

const deadline = Date.now() + 45000;
while (Date.now() < deadline) {
  if (await evalJs(`document.body ? document.body.innerText.includes("Enter") : false`)) break;
  await sleep(250);
}
await sleep(500);
console.log("t0  :", await evalJs(SAMPLE));
await sleep(2200);
console.log("t+2.2s(动画中):", await evalJs(SAMPLE));
await sleep(2300);
console.log("t+4.5s:", await evalJs(SAMPLE));
await sleep(4100);
console.log("t+8.6s:", await evalJs(SAMPLE));

edge.kill();
setTimeout(() => {
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch {}
  process.exit(0);
}, 500);
