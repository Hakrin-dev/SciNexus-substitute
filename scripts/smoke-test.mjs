/**
 * API 冒烟测试（端到端）
 * 需要先启动 dev server：pnpm dev（默认 http://localhost:3000）
 * 运行：node scripts/smoke-test.mjs
 *
 * 覆盖：
 *  - 健康检查 / 公开接口
 *  - 登录获取 HttpOnly 会话 Cookie
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

  const sampleCards = await fetch(`${BASE}/api/projects/scinexus/thread-cards`).then((r) => r.json());
  const sampleAssets = await fetch(`${BASE}/api/projects/scinexus/assets`).then((r) => r.json());
  const originalCards = sampleCards?.data?.filter((card) => !card.id.startsWith("ar_card_")) ?? [];
  const researchCards = sampleCards?.data?.filter((card) => card.id.startsWith("ar_card_")) ?? [];
  const runAssets = sampleAssets?.data?.filter((asset) => asset.artifact?.runId === "run_demo_citation_reliability") ?? [];
  const reportAsset = runAssets.find((asset) => asset.artifact?.stage === "report");
  const assetIds = new Set(sampleAssets?.data?.map((asset) => asset.id) ?? []);
  const danglingAssetRefs = (sampleCards?.data ?? []).flatMap((card) => card.assetRefs ?? []).filter((id) => !assetIds.has(id));
  check("公共示例保留 9 张原研究卡片", originalCards.length === 9, `实际 ${originalCards.length}`);
  check("公共示例包含 8 张自动研究卡片", researchCards.length === 8, `实际 ${researchCards.length}`);
  check("公共示例 8 个阶段资产与报告对应", runAssets.length === 8 && !!reportAsset?.artifact?.content, `资产 ${runAssets.length}`);
  check("公共示例卡片不存在悬空资产引用", danglingAssetRefs.length === 0, danglingAssetRefs.join(", "));

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
  const setCookie = loginRes.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0];
  check(
    "POST /api/auth/login 设置 HttpOnly 会话 Cookie",
    login?.success === true && cookie.includes("=") && /httponly/i.test(setCookie),
    JSON.stringify(login).slice(0, 120),
  );

  if (cookie) {
    const authHeaders = { Cookie: cookie };

    // 6. 登录后访问鉴权接口
    const libOk = await fetch(`${BASE}/api/library`, { headers: authHeaders }).then((r) => r.json());
    check("GET /api/library 登录后正常", libOk?.success === true);

    const graphOk = await fetch(`${BASE}/api/graph/private`, { headers: authHeaders }).then((r) => r.json());
    check("GET /api/graph/private 登录后正常", graphOk?.success === true);

    const me = await fetch(`${BASE}/api/auth/me`, { headers: authHeaders }).then((r) => r.json());
    check("GET /api/auth/me 返回当前用户", me?.success === true && me?.data?.username === "hankairun");

    // 7. 真实项目创建后应立即拥有可交互的研究骨架
    let temporaryProjectId;
    try {
      const projectResponse = await fetch(`${BASE}/api/projects`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "冒烟测试临时课题", tagline: "验证持久化研究交互", members: [] }),
      }).then((r) => r.json());
      temporaryProjectId = projectResponse?.data?.id;
      check("创建真实项目返回项目 ID", !!temporaryProjectId);
      if (temporaryProjectId) {
        const [outline, threads, cards] = await Promise.all([
          fetch(`${BASE}/api/projects/${temporaryProjectId}/outline`, { headers: authHeaders }).then((r) => r.json()),
          fetch(`${BASE}/api/projects/${temporaryProjectId}/threads`, { headers: authHeaders }).then((r) => r.json()),
          fetch(`${BASE}/api/projects/${temporaryProjectId}/thread-cards`, { headers: authHeaders }).then((r) => r.json()),
        ]);
        check(
          "新项目自动建立问题、线程和目标卡",
          outline?.data?.length === 1 && threads?.data?.length === 1 && cards?.data?.length === 1,
        );
        const added = await fetch(`${BASE}/api/projects/${temporaryProjectId}/thread-cards`, {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId: threads.data[0].id,
            kind: "next",
            stage: "search",
            title: "用户补充 · 检索",
            summary: "优先检索同行评审文献",
            status: "todo",
          }),
        }).then((r) => r.json());
        check("研究记录写入数据库并保留阶段", added?.data?.stage === "search");

        const started = await fetch(`${BASE}/api/projects/${temporaryProjectId}/research-runs`, {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({
            objective: "验证自动研究从计划到报告的完整闭环",
            config: { research_profile: "fast" },
          }),
        }).then((r) => r.json());
        const runId = started?.data?.run?.id;
        check("真实项目可以启动自动研究", !!runId);
        if (runId) {
          let completedRun;
          for (let attempt = 0; attempt < 40; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 250));
            const runs = await fetch(`${BASE}/api/projects/${temporaryProjectId}/research-runs`, {
              headers: authHeaders,
            }).then((r) => r.json());
            completedRun = runs?.data?.find((run) => run.id === runId);
            if (["completed", "failed", "cancelled"].includes(completedRun?.status)) break;
          }
          check("自动研究执行完成", completedRun?.status === "completed", completedRun?.errorMessage);
          const completedAssets = await fetch(`${BASE}/api/projects/${temporaryProjectId}/assets`, {
            headers: authHeaders,
          }).then((r) => r.json());
          const generated = completedAssets?.data?.filter((asset) => asset.artifact?.runId === runId) ?? [];
          check(
            "自动研究生成 8 阶段资产与最终报告",
            generated.length === 8 && generated.some((asset) => asset.artifact?.stage === "report"),
            `实际 ${generated.length} 个`,
          );
        }
      }
    } finally {
      if (temporaryProjectId) {
        await fetch(`${BASE}/api/projects/${temporaryProjectId}`, { method: "DELETE", headers: authHeaders });
      }
    }

    // 8. 登出后原 Cookie 失效
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
