"use client";

import * as React from "react";
import Image from "next/image";
import { Database, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/stores/toast";
import hfLogo from "@/brand/LOGO/HuggingFace.svg";
import {
  DB_STATS,
  dbBenchmarks,
  dbInstitutions,
  dbPapers,
  dbScholars,
  type DbBenchmark,
  type DbInstitution,
  type DbPaper,
  type DbScholar,
} from "@/lib/data/database";

/* ── 通用:搜索框 ─────────────────────────────────────────── */
function TableSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
      <Input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="pl-9" />
    </div>
  );
}

/* ── 统计卡 ─────────────────────────────────────────────── */
function StatCards() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {DB_STATS.map((s) => (
        <Card key={s.key} className="p-4">
          <p className="text-xs text-faint">{s.label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-ink">{s.value}</p>
          <p className="mt-0.5 text-[11px] text-faint">{s.hint}</p>
        </Card>
      ))}
    </div>
  );
}

/* ── 论文表 ─────────────────────────────────────────────── */
function PapersTable() {
  const [q, setQ] = React.useState("");
  const rows = dbPapers.filter((p) => {
    const s = q.trim().toLowerCase();
    return !s || `${p.title} ${p.authors} ${p.venue} ${p.field}`.toLowerCase().includes(s);
  });
  return (
    <div className="space-y-3">
      <TableSearch value={q} onChange={setQ} placeholder="搜索论文 / 作者 / 会议…" />
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-panel/60 text-xs text-faint">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">标题</th>
              <th className="px-4 py-2.5 text-left font-medium">作者</th>
              <th className="px-4 py-2.5 text-left font-medium">发表</th>
              <th className="px-4 py-2.5 text-right font-medium">被引</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p: DbPaper) => (
              <tr key={p.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{p.title}</p>
                  <Badge variant="gray" className="mt-1">{p.field}</Badge>
                </td>
                <td className="px-4 py-3 text-muted">{p.authors}</td>
                <td className="px-4 py-3 text-muted">{p.venue} {p.year}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-2">{p.citations}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-faint">没有匹配的论文</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ── 学者表 ─────────────────────────────────────────────── */
function ScholarsTable() {
  const [q, setQ] = React.useState("");
  const rows = dbScholars.filter((s) => {
    const t = q.trim().toLowerCase();
    return !t || `${s.name} ${s.affiliation} ${s.field}`.toLowerCase().includes(t);
  });
  return (
    <div className="space-y-3">
      <TableSearch value={q} onChange={setQ} placeholder="搜索学者 / 机构 / 方向…" />
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-panel/60 text-xs text-faint">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">学者</th>
              <th className="px-4 py-2.5 text-left font-medium">机构</th>
              <th className="px-4 py-2.5 text-left font-medium">方向</th>
              <th className="px-4 py-2.5 text-right font-medium">h-index</th>
              <th className="px-4 py-2.5 text-right font-medium">论文</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s: DbScholar) => (
              <tr key={s.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium text-ink">{s.name}</td>
                <td className="px-4 py-3 text-muted">{s.affiliation}</td>
                <td className="px-4 py-3 text-muted">{s.field}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-2">{s.hIndex}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-2">{s.papers}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-faint">没有匹配的学者</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ── 机构表 ─────────────────────────────────────────────── */
function InstitutionsTable() {
  const [q, setQ] = React.useState("");
  const rows = dbInstitutions.filter((i) => {
    const t = q.trim().toLowerCase();
    return !t || `${i.name} ${i.country} ${i.field}`.toLowerCase().includes(t);
  });
  return (
    <div className="space-y-3">
      <TableSearch value={q} onChange={setQ} placeholder="搜索机构 / 国家…" />
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-panel/60 text-xs text-faint">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">机构</th>
              <th className="px-4 py-2.5 text-left font-medium">国家</th>
              <th className="px-4 py-2.5 text-left font-medium">主攻方向</th>
              <th className="px-4 py-2.5 text-right font-medium">学者数</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i: DbInstitution) => (
              <tr key={i.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium text-ink">{i.name}</td>
                <td className="px-4 py-3 text-muted">{i.country}</td>
                <td className="px-4 py-3 text-muted">{i.field}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-2">{i.scholars}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-faint">没有匹配的机构</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ── 基准表 ─────────────────────────────────────────────── */
function BenchmarksTable() {
  const [q, setQ] = React.useState("");
  const rows = dbBenchmarks.filter((b) => {
    const t = q.trim().toLowerCase();
    return !t || `${b.name} ${b.task} ${b.leader}`.toLowerCase().includes(t);
  });
  return (
    <div className="space-y-3">
      <TableSearch value={q} onChange={setQ} placeholder="搜索基准 / 任务…" />
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-panel/60 text-xs text-faint">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">基准</th>
              <th className="px-4 py-2.5 text-left font-medium">任务</th>
              <th className="px-4 py-2.5 text-left font-medium">指标</th>
              <th className="px-4 py-2.5 text-left font-medium">当前榜首</th>
              <th className="px-4 py-2.5 text-right font-medium">得分</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b: DbBenchmark) => (
              <tr key={b.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium text-ink">{b.name}</td>
                <td className="px-4 py-3 text-muted">{b.task}</td>
                <td className="px-4 py-3 text-muted">{b.metric}</td>
                <td className="px-4 py-3 text-muted">{b.leader}</td>
                <td className="px-4 py-3 text-right tabular-nums text-primary">{b.score}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-faint">没有匹配的基准</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ── 从 Hugging Face 拉取(演示) ───────────────────────────── */
function HuggingFaceImport() {
  const [url, setUrl] = React.useState("");
  const [items, setItems] = React.useState<{ kind: string; id: string }[]>([]);

  const handlePull = () => {
    const m = url
      .trim()
      .match(
        /^https?:\/\/(www\.)?huggingface\.co\/(datasets|models|spaces)\/([\w.-]+)(?:\/([\w.-]+))?/i,
      );
    if (!m) {
      toast.error(
        "请输入有效的 Hugging Face 链接(如 https://huggingface.co/datasets/owner/name)",
      );
      return;
    }
    const kind = m[2];
    const id = m[4] ? `${m[3]}/${m[4]}` : m[3];
    setItems((prev) => [{ kind, id }, ...prev].slice(0, 8));
    setUrl("");
    toast.success(`已从 Hugging Face 拉取「${id}」(${kind})`);
  };

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-center gap-2">
        <Image
          src={hfLogo}
          alt="Hugging Face"
          width={20}
          height={20}
          className="size-5 object-contain"
        />
        <h2 className="text-[15px] font-semibold text-ink">从 Hugging Face 中获取</h2>
      </div>
      <p className="mt-1 text-xs text-faint">
        输入 Hugging Face 数据集 / 模型 / Space 链接即可拉取元数据到数据库(演示:解析链接,真实拉取待接入后端)
      </p>
      <div className="mt-3 flex gap-2">
        <Input
          placeholder="https://huggingface.co/datasets/owner/dataset-name"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handlePull()}
          className="font-mono text-[13px]"
        />
        <Button variant="soft" size="sm" className="shrink-0" onClick={handlePull}>
          拉取
        </Button>
      </div>
      {items.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {items.map((it, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-lg bg-chip px-3 py-2 text-xs text-ink-2"
            >
              <Image
                src={hfLogo}
                alt=""
                width={14}
                height={14}
                className="size-3.5 object-contain"
              />
              <span className="rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {it.kind}
              </span>
              <span className="font-mono">{it.id}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ── 主组件 ─────────────────────────────────────────────── */
export function DatabaseBrowser() {
  return (
    <div className="mx-auto max-w-[1180px] space-y-5 px-8 py-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft">
          <Database className="size-5 text-primary" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-ink">科研数据库</h1>
            <Badge variant="amber">演示原型</Badge>
          </div>
          <p className="mt-0.5 text-xs text-faint">
            跨论文 / 学者 / 机构 / 基准的统一检索入口,演示数据,不连后端
          </p>
        </div>
      </div>

      <HuggingFaceImport />

      <StatCards />

      <Tabs defaultValue="papers">
        <TabsList className="gap-4 border-b border-line">
          <TabsTrigger value="papers" className="flex items-center gap-1.5">论文</TabsTrigger>
          <TabsTrigger value="scholars" className="flex items-center gap-1.5">学者</TabsTrigger>
          <TabsTrigger value="institutions" className="flex items-center gap-1.5">机构</TabsTrigger>
          <TabsTrigger value="benchmarks" className="flex items-center gap-1.5">基准</TabsTrigger>
        </TabsList>
        <TabsContent value="papers" className="mt-5">
          <PapersTable />
        </TabsContent>
        <TabsContent value="scholars" className="mt-5">
          <ScholarsTable />
        </TabsContent>
        <TabsContent value="institutions" className="mt-5">
          <InstitutionsTable />
        </TabsContent>
        <TabsContent value="benchmarks" className="mt-5">
          <BenchmarksTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
