"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";

/**
 * 轻量 Markdown 渲染器（零依赖，供 AI 回答展示用）。
 *
 * 支持子集：标题(h1-h4)、段落、粗体/斜体/行内代码、链接、有序/无序列表（含缩进嵌套）、
 * 引用块、分隔线、围栏代码块、管道表格。流式输出时按内容整体重渲染，量级足够小。
 */

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; items: { ordered: boolean; depth: number; text: string }[] }
  | { type: "code"; lang: string; code: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "hr" };

const CODE_SPAN_RE = /(`[^`\n]+`)/g;
const RICH_SPAN_RE = /(\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^)\s]+\)|\*[^*\n]+\*)/g;
const LINK_RE = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

function renderRichText(text: string, keyBase: string): ReactNode[] {
  const segs = text.split(RICH_SPAN_RE);
  return segs.map((seg, index) => {
    const key = `${keyBase}-${index}`;
    if (!seg) return null;
    if (seg.startsWith("**") && seg.endsWith("**") && seg.length > 4) {
      return (
        <strong key={key} className="font-semibold text-ink">
          {seg.slice(2, -2)}
        </strong>
      );
    }
    if (seg.startsWith("*") && seg.endsWith("*") && seg.length > 2) {
      return (
        <em key={key} className="italic">
          {seg.slice(1, -1)}
        </em>
      );
    }
    const link = seg.match(LINK_RE);
    if (link) {
      return (
        <a
          key={key}
          href={link[2]}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline underline-offset-2"
        >
          {link[1]}
        </a>
      );
    }
    return <span key={key}>{seg}</span>;
  });
}

function renderInline(text: string, keyBase: string): ReactNode[] {
  const parts = text.split(CODE_SPAN_RE);
  return parts.map((part, index) => {
    const key = `${keyBase}-${index}`;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return (
        <code
          key={key}
          className="rounded-md bg-chip px-1.5 py-0.5 font-mono text-[12px] text-ink-2"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (!part) return null;
    return <span key={key}>{renderRichText(part, key)}</span>;
  });
}

const LIST_ITEM_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const TABLE_SEP_RE = /^\s*\|?\s*:?-{2,}.*\|\s*$/;

function parseBlocks(content: string): Block[] {
  const lines = content.split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    // 围栏代码块
    const fence = line.match(/^```(\S*)\s*$/);
    if (fence) {
      const lang = fence[1] || "";
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1; // 跳过结束围栏
      blocks.push({ type: "code", lang, code: code.join("\n") });
      continue;
    }

    // 空行
    if (!line.trim()) {
      index += 1;
      continue;
    }

    // 表格
    if (line.trimStart().startsWith("|") && index + 1 < lines.length && TABLE_SEP_RE.test(lines[index + 1])) {
      const splitRow = (row: string) =>
        row
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((cell) => cell.trim());
      const headers = splitRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].trimStart().startsWith("|")) {
        rows.push(splitRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    // 标题
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2].trim() });
      index += 1;
      continue;
    }

    // 分隔线
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }

    // 引用块（连续）
    if (line.trimStart().startsWith(">")) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trimStart().startsWith(">")) {
        quoteLines.push(lines[index].trimStart().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "quote", text: quoteLines.join("\n") });
      continue;
    }

    // 列表（连续，含缩进嵌套）
    const listMatch = line.match(LIST_ITEM_RE);
    if (listMatch) {
      const items: { ordered: boolean; depth: number; text: string }[] = [];
      while (index < lines.length) {
        const current = lines[index].match(LIST_ITEM_RE);
        if (!current) break;
        items.push({
          ordered: /^\d/.test(current[2]),
          depth: Math.min(4, Math.floor(current[1].length / 2)),
          text: current[3],
        });
        index += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    // 普通段落（连续非空行合并）
    const para: string[] = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,4})\s/.test(lines[index]) &&
      !LIST_ITEM_RE.test(lines[index]) &&
      !lines[index].trimStart().startsWith(">") &&
      !lines[index].trimStart().startsWith("|") &&
      !/^```/.test(lines[index]) &&
      !/^\s*(-{3,}|\*{3,})\s*$/.test(lines[index])
    ) {
      para.push(lines[index]);
      index += 1;
    }
    blocks.push({ type: "paragraph", text: para.join("\n") });
  }

  return blocks;
}

export function MarkdownView({ content }: { content: string }) {
  const blocks = useMemo(() => parseBlocks(content), [content]);

  return (
    <div className="space-y-2 text-sm leading-relaxed text-ink-2">
      {blocks.map((block, index) => {
        const key = `${index}`;
        switch (block.type) {
          case "heading": {
            const Tag = (`h${Math.min(block.level, 4)}`) as "h1" | "h2" | "h3" | "h4";
            const headingClass =
              block.level <= 2
                ? "mt-3 text-base font-semibold text-ink first:mt-0"
                : "mt-2 text-sm font-semibold text-ink";
            return (
              <Tag key={key} className={headingClass}>
                {renderInline(block.text, `h-${key}`)}
              </Tag>
            );
          }
          case "paragraph":
            return <p key={key}>{renderInline(block.text, `p-${key}`)}</p>;
          case "quote":
            return (
              <blockquote
                key={key}
                className="border-l-2 border-primary/40 pl-3 text-muted"
              >
                {renderInline(block.text, `q-${key}`)}
              </blockquote>
            );
          case "list":
            return (
              <ul key={key} className="space-y-1 pl-4">
                {block.items.map((item, itemIndex) => (
                  <li
                    key={`${key}-${itemIndex}`}
                    className="flex gap-2"
                    style={{ marginLeft: item.depth * 16 }}
                  >
                    <span className="shrink-0 text-faint">
                      {item.ordered ? `${itemIndex + 1}.` : "•"}
                    </span>
                    <span className="min-w-0">{renderInline(item.text, `li-${key}-${itemIndex}`)}</span>
                  </li>
                ))}
              </ul>
            );
          case "code":
            return (
              <pre
                key={key}
                className="overflow-x-auto rounded-xl bg-sidebar p-3.5 font-mono text-[12px] leading-relaxed text-ink-2"
              >
                {block.lang && (
                  <div className="mb-1.5 text-[10px] uppercase tracking-wide text-faint">
                    {block.lang}
                  </div>
                )}
                <code>{block.code}</code>
              </pre>
            );
          case "table":
            return (
              <div key={key} className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-panel">
                      {block.headers.map((header, headerIndex) => (
                        <th
                          key={headerIndex}
                          className="border-b border-line px-2.5 py-2 text-left font-medium text-ink"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="border-b border-line/60 px-2.5 py-1.5 text-ink-2 last:border-b-0"
                          >
                            {renderInline(cell, `td-${key}-${rowIndex}-${cellIndex}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "hr":
            return <hr key={key} className="my-3 border-line" />;
          default:
            return null;
        }
      })}
    </div>
  );
}
