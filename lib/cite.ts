import type { AgentReference } from "@/types";

/** 引用格式:GB/T 7714(国标)/ APA / BibTeX */
export type CitationStyle = "gbt7714" | "apa" | "bibtex";

export const CITATION_STYLES: { value: CitationStyle; label: string }[] = [
  { value: "gbt7714", label: "GB/T 7714" },
  { value: "apa", label: "APA" },
  { value: "bibtex", label: "BibTeX" },
];

/** 从 venue 字段提取信息,如 "CoRL 2024 · Stanford" → { name: "CoRL", year: "2024" } */
function parseVenue(venue: string): { name: string; year: string } {
  const year = venue.match(/\d{4}/)?.[0] ?? "";
  const name = venue.split("·")[0].replace(/\d{4}/, "").trim();
  return { name, year };
}

/** 从 title 生成 BibTeX citekey,如 rdt1bDiffusion2026 */
function citeKey(ref: AgentReference, year: string): string {
  const firstWord =
    ref.title
      .split(/[\s:]+/)
      .find((w) => /^[A-Za-z]/.test(w))
      ?.replace(/[^A-Za-z]/g, "")
      .toLowerCase() ?? "ref";
  const author = ref.author.split(" ")[0].toLowerCase();
  return `${author}${firstWord}${year}`;
}

/** GB/T 7714-2015 顺序编码制:作者. 题名[C]//会议名, 年. */
export function formatGB7714(ref: AgentReference): string {
  const { name, year } = parseVenue(ref.venue);
  return `${ref.author} ${ref.title}[C]//${name}, ${year}.`;
}

/** APA 7th:Author. (Year). Title. Venue. */
export function formatAPA(ref: AgentReference): string {
  const { name, year } = parseVenue(ref.venue);
  return `${ref.author.replace(" et al.", " & colleagues")} (${year}). ${ref.title}. ${name}.`;
}

/** BibTeX @inproceedings 条目 */
export function formatBibTeX(ref: AgentReference): string {
  const { name, year } = parseVenue(ref.venue);
  const authors = ref.author.replace(" et al.", " and others");
  return [
    `@inproceedings{${citeKey(ref, year)},`,
    `  title     = {${ref.title}},`,
    `  author    = {${authors}},`,
    `  booktitle = {${name}},`,
    `  year      = {${year}}`,
    `}`,
  ].join("\n");
}

const FORMATTERS: Record<CitationStyle, (ref: AgentReference) => string> = {
  gbt7714: formatGB7714,
  apa: formatAPA,
  bibtex: formatBibTeX,
};

/** 按指定格式导出一条或多条引用(多条时空行分隔) */
export function formatCitation(
  refs: AgentReference | AgentReference[],
  style: CitationStyle,
): string {
  const list = Array.isArray(refs) ? refs : [refs];
  return list.map(FORMATTERS[style]).join("\n\n");
}
