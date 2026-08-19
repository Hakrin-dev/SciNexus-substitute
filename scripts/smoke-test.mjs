/**
 * API 冒烟测试（端到端）
 * 需要先启动 dev server：pnpm dev（默认 http://localhost:3000）
 * 运行：node scripts/smoke-test.mjs
 *
 * 覆盖：
 *  - 健康检查 / 公开接口
 *  - 登录获取 token
 *  - 鉴权接口未登录返回 401、登录后正常
 *  - 登出后 token 失效
 */
const BASE = process.env.API_BASE || "http://localhost:3000";

let passed = 0;
let failed = 0;

function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log(`\n研枢 API 冒烟测试 → ${BASE}\n`);

  // 1. 健康检查
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
  check("GET /api/health 返回 healthy", health?.status === "healthy");

  // 2. 公开接口：论文列表
  const papers = await fetch(`${BASE}/api/papers`).then((r) => r.json());
  check(
    "GET /api/papers 返回分页数据",
    papers?.success === true && Array.isArray(papers?.data),
    JSON.stringify(papers).slice(0, 120)
  );

  // 3. 公开接口：学者列表（含 citation_count 数值排序）
  const scholars = await fetch(`${BASE}/api/scholars`).then((r) => r.json());
  check("GET /api/scholars 返回数据", scholars?.success === true && Array.isArray(scholars?.data));

  // 4. 鉴权接口：未登录应 401
  const lib401 = await fetch(`${BASE}/api/library`);
  check("GET /api/library 未登录返回 401", lib401.status === 401, `实际 ${lib401.status}`);

  const graph401 = await fetch(`${BASE}/api/graph/private`);
  check("GET /api/graph/private 未登录返回 401", graph401.status === 401, `实际 ${graph401.status}`);

  // 5. 登录 demo 用户
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "hankairun", password: "yanshu123" }),
  });
  const login = await loginRes.json();
  const token = login?.data?.token;
  check("POST /api/auth/login 返回 token", login?.success === true && !!token, JSON.stringify(login).slice(0, 120));

  if (token) {
    const authHeaders = { Authorization: `Bearer ${token}` };

    // 6. 登录后访问鉴权接口
    const libOk = await fetch(`${BASE}/api/library`, { headers: authHeaders }).then((r) => r.json());
    check("GET /api/library 登录后正常", libOk?.success === true);

    const graphOk = await fetch(`${BASE}/api/graph/private`, { headers: authHeaders }).then((r) => r.json());
    check("GET /api/graph/private 登录后正常", graphOk?.success === true);

    const me = await fetch(`${BASE}/api/auth/me`, { headers: authHeaders }).then((r) => r.json());
    check("GET /api/auth/me 返回当前用户", me?.success === true && me?.data?.username === "hankairun");

    // 7. 登出后 token 失效
    await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: authHeaders });
    const meAfter = await fetch(`${BASE}/api/auth/me`, { headers: authHeaders });
    check("登出后 /api/auth/me 返回 401", meAfter.status === 401, `实际 ${meAfter.status}`);
  }

  console.log(`\n结果：${passed} 通过，${failed} 失败`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("测试执行异常：", e);
  process.exit(1);
});
