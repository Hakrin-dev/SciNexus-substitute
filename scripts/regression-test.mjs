import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { normalizeVenues, toFeedPaper, toPaperDetail } from "../lib/api/adapters.ts";
import { getAuthSecret } from "../lib/server/auth-secret.ts";
import {
  normalizeKnowledgeGraph,
  normalizeKnowledgePaper,
  toFrontendKnowledgePaper,
} from "../lib/server/knowledge-base.ts";
import { isPrivatePdfAddress } from "../lib/pdf-safety.ts";
import { getPublicAppUrl } from "../lib/server/app-url.ts";

test("Next authentication rejects a missing production AUTH_SECRET", () => {
  assert.throws(
    () => getAuthSecret({ NODE_ENV: "production" }),
    /生产环境必须配置 AUTH_SECRET/,
  );
});

test("password reset app URL rejects insecure production configuration", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAppUrl = process.env.APP_URL;
  const originalPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  try {
    process.env.NODE_ENV = "production";
    process.env.APP_URL = "http://localhost:3000";
    delete process.env.NEXT_PUBLIC_APP_URL;
    assert.throws(() => getPublicAppUrl(), /APP_URL_INSECURE/);

    process.env.APP_URL = "https://scinexus.example.com";
    assert.equal(getPublicAppUrl(), "https://scinexus.example.com");
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = originalAppUrl;
    if (originalPublicAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalPublicAppUrl;
  }
});

test("streaming API includes the HttpOnly session cookie", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url: String(url), init };
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("event: done\\n\\ndata: {}\\n\\n"));
        controller.close();
      },
    });
    return new Response(body, { status: 200 });
  };

  try {
    const { streamChat } = await import("../lib/api/client.ts");
    for await (const event of streamChat("/api/chat/stream", { message: "test" })) {
      assert.equal(event.type, "done");
    }
    assert.equal(request.init.credentials, "include");
    assert.equal(request.init.headers.Authorization, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const pythonProbe = spawnSync("python", ["--version"], { encoding: "utf8" });
const pythonUnavailable = pythonProbe.error?.code === "ENOENT" || pythonProbe.status !== 0;

test("FastAPI authentication rejects a missing production AUTH_SECRET", {
  skip: pythonUnavailable ? "Python runtime is not installed on this machine" : false,
}, () => {
  const result = spawnSync(
    "python",
    [
      "-c",
      "import server.auth",
    ],
    {
      cwd: `${process.cwd()}/backend`,
      env: { ...process.env, NODE_ENV: "production", AUTH_SECRET: "" },
      encoding: "utf8",
    },
  );

  assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(`${result.stdout}\n${result.stderr}`, /AUTH_SECRET/);
});

test("external venue payload gains arrays required by VenueCard", () => {
  const [venue] = normalizeVenues([
    {
      id: "venue-1",
      kind: "conference",
      abbr: "TESTCONF",
      fullName: "Test Conference",
      ccf: "A",
      domain: "Machine Learning",
      urgent: true,
    },
  ]);

  assert.deepEqual(venue.badges, ["CCF A"]);
  assert.deepEqual(venue.metaRows, [[ ["folder", "Machine Learning"] ]]);
  assert.deepEqual(venue.chips, ["Machine Learning"]);
});

test("pre-shaped venue payload preserves visual fields required by VenueCard", () => {
  const [venue] = normalizeVenues([
    {
      id: "venue-2",
      kind: "conference",
      abbr: "SHAPED",
      fullName: "Already Shaped Conference",
      badges: ["CCF A"],
      metaRows: [[ ["pin", "Online"] ]],
      chips: ["Systems"],
      accent: "danger",
      deadline: { label: "Deadline", dateText: "2026-12-01", offsetMs: 1 },
    },
  ]);

  assert.deepEqual(venue.badges, ["CCF A"]);
  assert.deepEqual(venue.metaRows, [[ ["pin", "Online"] ]]);
  assert.deepEqual(venue.chips, ["Systems"]);
  assert.equal(venue.accent, "danger");
  assert.deepEqual(venue.deadline, {
    label: "Deadline",
    dateText: "2026-12-01",
    offsetMs: 1,
  });
});

test("remote knowledge paper fields map to the existing frontend paper contract", () => {
  const paper = toFrontendKnowledgePaper(normalizeKnowledgePaper({
    paper_id: "paper:remote:1",
    title: "Remote Paper",
    conference: "AAAI",
    authors: [{ name: "Alice" }, "Bob"],
    keywords: ["graph"],
    subjects: ["AI"],
    score: 0.022,
    rank: 1,
  }));

  assert.equal(paper.id, "paper:remote:1");
  assert.equal(paper.authors, "Alice, Bob");
  assert.equal(paper.venue, "AAAI");
  assert.deepEqual(paper.tags, ["graph", "AI"]);
  assert.equal(paper.knowledgeScore, 0.022);
  assert.equal(paper.source, "remote_knowledge_base");
});

test("knowledge contract preserves unknown citation and reference counts as null", () => {
  const paper = normalizeKnowledgePaper({
    paper_id: "paper:remote:nullable-counts",
    title: "Remote Paper",
    citation_count: "",
    referenceCount: undefined,
  });

  assert.equal(paper.citationCount, null);
  assert.equal(paper.referenceCount, null);
});

test("PDF proxy rejects loopback and private network targets", () => {
  assert.equal(isPrivatePdfAddress("127.0.0.1"), true);
  assert.equal(isPrivatePdfAddress("10.0.0.8"), true);
  assert.equal(isPrivatePdfAddress("172.20.0.1"), true);
  assert.equal(isPrivatePdfAddress("192.168.1.20"), true);
  assert.equal(isPrivatePdfAddress("::1"), true);
  assert.equal(isPrivatePdfAddress("8.8.8.8"), false);
});

test("remote search cards retain source data and never render NaN likes", () => {
  const card = toFeedPaper({
    id: "paper:remote:1",
    title: "Remote Paper",
    authors: "",
    venue: "AAAI",
    citations: Number.NaN,
    year: 2021,
    source: "remote_knowledge_base",
    rank: 1,
    knowledgeScore: 0.022,
  });

  assert.equal(card.likes, 0);
  assert.equal(card.citations, 0);
  assert.equal(card.date, "2021");
  assert.equal(card.authors, "未提供作者");
  assert.equal(card.source, "remote_knowledge_base");
  assert.equal(card.rank, 1);
});

test("remote paper details preserve camelCase PDF URLs for the reader", () => {
  const paper = toPaperDetail({
    id: "paper:remote:pdf",
    title: "Remote PDF Paper",
    authors: "Alice",
    venue: "AAAI",
    abstract: "Abstract",
    pdfUrl: "https://papers.example.test/remote.pdf",
  }, "paper:remote:pdf");

  assert.equal(paper.pdfUrl, "https://papers.example.test/remote.pdf");
  assert.equal(paper.readingState, "pdf");
});

test("remote graph normalization preserves directed citation lines", () => {
  const graph = normalizeKnowledgeGraph({
    rootId: "paper:a",
    nodes: [{ id: "paper:a", title: "A" }, { id: "paper:b", title: "B" }],
    lines: [{ from: "paper:a", to: "paper:b", text: "CITES", data: { type: "CITES" } }],
  });

  assert.equal(graph.rootId, "paper:a");
  assert.deepEqual(graph.lines[0], {
    from: "paper:a",
    to: "paper:b",
    text: "CITES",
    data: { type: "CITES" },
  });
});

test("external project creation submits the wizard payload and returns the backend project id", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url: String(url), init };
    return new Response(JSON.stringify({ data: { id: "proj-created" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const { createProject } = await import("../lib/api/client.ts");
    const id = await createProject({
      name: "Scientific Retrieval Evaluation",
      tagline: "Evaluate retrieval quality",
      overview: ["Evaluate retrieval quality"],
      techStack: ["Next.js", "FastAPI"],
      members: [{ name: "Lin", role: "Lead" }],
      milestones: [],
      links: [],
    });

    assert.equal(id, "proj-created");
    assert.equal(request.url, "/api/projects");
    assert.equal(request.init.method, "POST");
    assert.deepEqual(JSON.parse(request.init.body), {
      name: "Scientific Retrieval Evaluation",
      tagline: "Evaluate retrieval quality",
      overview: ["Evaluate retrieval quality"],
      techStack: ["Next.js", "FastAPI"],
      members: [{ name: "Lin", role: "Lead" }],
      milestones: [],
      links: [],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
