#!/usr/bin/env node
/**
 * 发现页 Alt+Enter 就地检索 + 排序菜单 交互验证截图。
 * 必须由 **Windows 侧 node** 执行(见 shot-cdp.mjs 头注),UNC 路径引用。
 *
 * 用法:
 *   node.exe shot-altsearch.mjs --url http://localhost:3000/ --out-dir "C:\Users\xxx\AppData\Local\Temp"
 */
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`;

const args = { width: 1440, height: 1400 };
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

const profile = mkdtempSync(join(tmpdir(), "edge-alt-"));
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

// 首页加载(标签行在 → 未检索态)
await waitText("个性化");
await sleep(800);
await shot("f_alt_1_idle.png");

// 探针:页面上下文直接 fetch 搜索接口,确认数据通路
const probe = await cdp(
  "Runtime.evaluate",
  {
    expression: `fetch('/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'Transformer'})}).then(r=>r.json()).then(j=>'len:'+(j.data?j.data.length:'none')+' first:'+(j.data&&j.data[0]&&j.data[0].id)).catch(e=>'err:'+e.message)`,
    awaitPromise: true,
    returnByValue: true,
  },
  sessionId,
);
console.log("probe:", probe.result.value);

// 输入关键词并按下 Alt+Enter(原生 setter + React 受控输入)
console.log(
  "type + Alt+Enter:",
  await evalJs(`(() => {
    const ta = document.querySelector("textarea");
    if (!ta) return "no-textarea";
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(ta, "Transformer");
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.dispatchEvent(new KeyboardEvent("keydown",
      { key: "Enter", altKey: true, bubbles: true }));
    return "ok";
  })()`),
);

// 等待结果头部出现(标签行应消失)
await waitText("当前检索结果如下", 20000);
await sleep(2600); // 卡片 stagger 动画
await shot("f_alt_2_results.png");

// 标签行是否真的消失
console.log(
  "tabs gone:",
  await evalJs(`!document.body.innerText.includes("个性化")`),
);

// 点开排序菜单
console.log(
  "click 排序:",
  await evalJs(`(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => x.innerText.trim() === "排序" && x.offsetParent !== null);
    if (!b) return false;
    b.click();
    return true;
  })()`),
);
await sleep(400);
await shot("f_alt_3_sortmenu.png");

// 选中「引用次数」(默认升序 ↑)
console.log(
  "click 引用次数:",
  await evalJs(`(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => x.innerText.trim() === "引用次数" && x.offsetParent !== null);
    if (!b) return false;
    b.click();
    return true;
  })()`),
);
await sleep(1600);
await shot("f_alt_4_citations_asc.png");

// 再点开菜单,点「引用次数」的箭头 → 降序 ↓
await evalJs(`(() => {
  const b = [...document.querySelectorAll("button")].find(
    (x) => x.innerText.trim() === "排序" && x.offsetParent !== null);
  if (b) b.click();
  return true;
})()`);
await sleep(400);
console.log(
  "toggle 引用次数 dir:",
  await evalJs(`(() => {
    const b = document.querySelector('button[aria-label="引用次数切换升降序"]');
    if (!b) return false;
    b.click();
    return true;
  })()`),
);
await sleep(1600);
await shot("f_alt_5_citations_desc.png");

edge.kill();
setTimeout(() => {
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
  } catch {}
  console.log("done");
  process.exit(0);
}, 500);
