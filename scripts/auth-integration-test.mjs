/**
 * 认证端到端集成测试。
 *
 * 测试启动独立 Next dev server、临时 SQLite 和测试邮件 outbox，覆盖：
 * 注册邮箱 OTP -> 注册 -> 密码登录 -> 登录 OTP -> 密码重置。
 * 测试邮件 outbox 仅在非生产环境且显式配置 AUTH_TEST_EMAIL_OUTBOX 时启用。
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const testRoot = path.join(os.tmpdir(), `scinexus-auth-${Date.now()}`);
const dbPath = path.join(testRoot, "auth.db");
const outboxPath = path.join(testRoot, "email.jsonl");
const port = 3300 + (Date.now() % 200);
const base = `http://127.0.0.1:${port}`;
const username = `auth-it-${Date.now()}`;
const email = `${username}@example.com`;
const initialPassword = "Test-password-123";
const resetPassword = "Reset-password-456";

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function readOutbox() {
  if (!existsSync(outboxPath)) return [];
  return readFileSync(outboxPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function latestMail(subjectPart) {
  return [...readOutbox()].reverse().find((mail) => mail.subject.includes(subjectPart));
}

function cookieFrom(response, name) {
  const setCookie = response.headers.get("set-cookie") || "";
  const match = setCookie.match(new RegExp(`${name}=([^;]*)`));
  return match ? `${name}=${match[1]}` : "";
}

async function request(pathname, options = {}) {
  return fetch(`${base}${pathname}`, options);
}

async function json(response) {
  return response.json();
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await request("/api/health");
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Next dev server did not become ready");
}

async function main() {
  mkdirSync(testRoot, { recursive: true });
  const server = spawn("pnpm dev -p " + String(port), {
    cwd: projectRoot,
    env: {
      ...process.env,
      API_BASE: base,
      SCINEXUS_DB_PATH: dbPath,
      AUTH_TEST_EMAIL_OUTBOX: outboxPath,
      AUTH_SECRET: "auth-integration-test-secret",
      EMAIL_REQUIRED: "true",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    shell: true,
  });
  server.stdout.on("data", (chunk) => process.stdout.write(`[server] ${chunk}`));
  server.stderr.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));

  try {
    await waitForServer();
    console.log(`\n研枢认证集成测试 → ${base}\n`);

    let response = await request("/api/auth/register/send-otp", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.10" },
      body: JSON.stringify({ email }),
    });
    let payload = await json(response);
    const registrationMail = latestMail("注册验证码");
    check("注册发送 OTP", response.status === 200 && payload?.data?.challengeId && registrationMail?.otp);

    response = await request("/api/auth/register/verify-otp", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.11" },
      body: JSON.stringify({ email, challengeId: payload.data.challengeId, otp: registrationMail.otp }),
    });
    payload = await json(response);
    const registrationCookie = cookieFrom(response, "registration_ticket");
    check("注册 OTP 验证签发 ticket Cookie", response.status === 200 && !!registrationCookie && /httponly/i.test(response.headers.get("set-cookie") || ""));

    response = await request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: registrationCookie },
      body: JSON.stringify({ username, password: initialPassword, displayName: "认证集成测试" }),
    });
    payload = await json(response);
    const sessionCookie = cookieFrom(response, "yanshu_session");
    check("完成注册并签发会话 Cookie", response.status === 200 && payload?.success === true && !!sessionCookie);

    response = await request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.12" },
      body: JSON.stringify({ username: username.toUpperCase(), password: initialPassword }),
    });
    payload = await json(response);
    check("用户名大小写不敏感登录", response.status === 200 && payload?.success === true);

    response = await request("/api/auth/login/send-otp", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.13" },
      body: JSON.stringify({ email: email.toUpperCase() }),
    });
    payload = await json(response);
    const loginMail = latestMail("登录验证码");
    check("发送登录 OTP 并归一化邮箱", response.status === 200 && payload?.data?.challengeId && loginMail?.otp);

    response = await request("/api/auth/login/verify-otp", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.14" },
      body: JSON.stringify({ email: email.toUpperCase(), challengeId: payload.data.challengeId, otp: loginMail.otp }),
    });
    payload = await json(response);
    check("登录 OTP 验证成功", response.status === 200 && payload?.success === true && !!cookieFrom(response, "yanshu_session"));

    response = await request("/api/auth/password/request-reset", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.15" },
      body: JSON.stringify({ email }),
    });
    payload = await json(response);
    const resetMail = latestMail("重置密码");
    const resetToken = resetMail?.urls?.[0] ? new URL(resetMail.urls[0]).searchParams.get("token") : null;
    check("发送密码重置邮件", response.status === 200 && payload?.success === true && !!resetToken);

    response = await request("/api/auth/password/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: resetToken, newPassword: resetPassword }),
    });
    payload = await json(response);
    check("一次性重置 token 修改密码", response.status === 200 && payload?.success === true);

    response = await request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.16" },
      body: JSON.stringify({ username, password: resetPassword }),
    });
    payload = await json(response);
    check("重置后新密码可登录", response.status === 200 && payload?.success === true);

    response = await request("/api/auth/password/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: resetToken, newPassword: "Another-password-789" }),
    });
    check("重置 token 不可重复使用", response.status === 400 || response.status === 401 || response.status === 403);
  } finally {
    if (process.platform === "win32" && server.pid) {
      spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
    } else {
      server.kill();
    }
    try {
      rmSync(testRoot, { recursive: true, force: true });
    } catch {
      // Windows may release the dev server lock just after taskkill; test data is temporary.
    }
  }

  console.log(`\n结果：${passed} 通过，${failed} 失败`);
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`\n集成测试启动失败：${error.message}`);
  process.exitCode = 1;
});
