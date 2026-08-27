"use client";

import * as React from "react";
import { Database, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
