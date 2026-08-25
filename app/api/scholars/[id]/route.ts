/**
 * GET /api/scholars/[id]
 * 获取学者详情（含发表论文、年引用图表数据）
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok } from "@/lib/server/utils";
import { getDB, jsonParse } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureSeed();
  const { id } = await params;
  try {
    const userId = getCurrentUser(req)?.id ?? "";
    const db = getDB();

    const scholar = db.prepare("SELECT * FROM scholars WHERE id = ?").get(id) as any;
    if (!scholar) return fail("学者未找到", 404);

    // 是否已关注
    const followRow = db
      .prepare("SELECT 1 FROM followed_scholars WHERE user_id = ? AND scholar_id = ?")
      .get(userId, id);

    // 发表论文
    const pubs = db
      .prepare("SELECT * FROM scholar_publications WHERE scholar_id = ? ORDER BY citations DESC")
      .all(id) as any[];

    // 年引用数据
    const yearlyRows = db
      .prepare("SELECT year, value FROM scholar_yearly_citations WHERE scholar_id = ? ORDER BY year ASC")
      .all(id) as any[];

    const years = yearlyRows.map((r) => r.year);
    const values = yearlyRows.map((r) => r.value);

    // 第二段简介由学者真实数据派生(此前是人人相同的固定模板句)
    const introTags = jsonParse<string[]>(scholar.tags_json, []);
    const bioSecond =
      `现任 ${scholar.affiliation || "独立研究者"}${scholar.role ? ` ${scholar.role}` : ""}` +
      (introTags.length ? `，研究方向聚焦 ${introTags.slice(0, 3).join("、")}` : "") +
      `；在库收录论文 ${pubs.length} 篇，总被引 ${(scholar.citations ?? 0).toLocaleString()} 次（h-index ${scholar.h_index ?? "-"}）。`;

    const data = {
      id: scholar.id,
      nameCn: scholar.name_cn,
      nameEn: scholar.name_en,
      initials: scholar.initials,
      avatarColor: scholar.avatar_color,
      role: scholar.role,
      affiliation: scholar.affiliation,
      location: scholar.location,
      email: scholar.email,
      bio: [scholar.bio, bioSecond],
      introTags: introTags,
      metrics: {
        totalCitations: scholar.citations,
        hIndex: scholar.h_index,
        i10Index: Math.max(1, Math.round(scholar.h_index * 1.2)),
      },
      yearlyCitations: {
        years,
        values,
        highlight: values.length
          ? `${values[values.length - 1].toLocaleString()} · ${years[years.length - 1]}`
          : "",
      },
      links: ["Google Scholar", "个人主页", "GitHub", scholar.email ? "发送邮件" : null].filter(Boolean),
      toc: [
        { id: "intro", label: "个人简介", active: true },
        { id: "works", label: `研究成果 · ${pubs.length}` },
        { id: "coauthors", label: "合作者" },
        { id: "activity", label: "学术活动" },
      ],
      publications: pubs.map((p) => ({
        id: p.id,
        title: p.title,
        abstract: p.abstract,
        authors: p.authors,
        venue: p.venue,
        citations: p.citations,
        citationsShort: p.citations_short,
      })),
      followed: !!followRow,
    };
    return ok(data);
  } catch (e: any) {
    return fail(e.message || "获取学者详情失败");
  }
}
