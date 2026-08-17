import type { PaperGraph } from "@/types";

/** 画布(viewBox)尺寸 */
export const VIEW_W = 1080;
export const VIEW_H = 820;
const CX = VIEW_W / 2;
const CY = VIEW_H / 2 - 40; // 370,底部留给标签与图例

export interface PlacedNode {
  x: number;
  y: number;
  r: number;
}

/** 字符串 → 0~1 确定性伪随机(布局抖动用,保证 SSR 一致) */
export function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h / 0xffffffff;
}

/** 权重 → 圆半径(16~46) */
export function nodeRadius(weight: number): number {
  return 16 + weight * 30;
}

/** 公域:origin 居中,其余按权重三同心环,环内均匀角分布 + 确定性抖动 */
export function concentricLayout(graph: PaperGraph): Map<string, PlacedNode> {
  const placed = new Map<string, PlacedNode>();
  placed.set(graph.origin.id, { x: CX, y: CY, r: 46 });

  const rings = [
    { min: 0.66, radius: 145, members: [] as PaperGraph["nodes"] },
    { min: 0.4, radius: 235, members: [] as PaperGraph["nodes"] },
    { min: 0, radius: 320, members: [] as PaperGraph["nodes"] },
  ];
  for (const node of graph.nodes) {
    (rings.find((ring) => node.weight > ring.min) ?? rings[2]).members.push(
      node,
    );
  }

  rings.forEach((ring, ringIndex) => {
    // 各环起始角错开,避免不同环节点沿半径方向重叠
    const startAngle = -Math.PI / 2 + ringIndex * 0.53;
    ring.members.forEach((node, i) => {
      const angleJitter = (hash(node.id) - 0.5) * 0.42; // ±12°
      const angle =
        (i / ring.members.length) * Math.PI * 2 + startAngle + angleJitter;
      const radius = ring.radius + (hash(node.id + ":r") - 0.5) * 36; // ±18px
      placed.set(node.id, {
        x: Math.round(CX + radius * Math.cos(angle)),
        y: Math.round(CY + radius * Math.sin(angle)),
        r: nodeRadius(node.weight),
      });
    });
  });
  return placed;
}

/** 私域:上下双层带(上=我的发表,下=收藏论文),层内权重越大越靠中轴 */
export function strataLayout(graph: PaperGraph): Map<string, PlacedNode> {
  const placed = new Map<string, PlacedNode>();
  const bands = [
    { layer: "mine" as const, y: 190 },
    { layer: "folder" as const, y: 570 },
  ];
  for (const band of bands) {
    const members = [graph.origin, ...graph.nodes]
      .filter((n) => n.layer === band.layer)
      .sort((a, b) => b.weight - a.weight);
    const spread = Math.min(160, 880 / Math.max(members.length - 1, 1));
    members.forEach((node, i) => {
      placed.set(node.id, {
        x: Math.round(CX + (i - (members.length - 1) / 2) * spread),
        y: Math.round(band.y + (hash(node.id + ":y") - 0.5) * 64), // ±32px
        r: nodeRadius(node.weight),
      });
    });
  }
  return placed;
}
