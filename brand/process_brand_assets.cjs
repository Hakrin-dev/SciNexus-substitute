/* 一次性品牌资产处理脚本:
 * 1. 从 brand/logo.png 提取 SciNexus 英文 wordmark(去白底→透明、按 alpha 裁剪)
 * 2. 用 lucide Sparkles(三十字星)生成 app/icon.png(橙底白星圆角图标)
 */
const sharp = require("/home/hkr/projects/scinexus/node_modules/.pnpm/sharp@0.34.5/node_modules/sharp");

const ROOT = "/home/hkr/projects/scinexus";

async function extractWordmark() {
  const { data, info } = await sharp(`${ROOT}/brand/logo.png`)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // 估计前景橙色的蓝通道值(高饱和像素的 5% 分位)——蓝通道与白底对比最大
  const blues = [];
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) > 60) blues.push(b);
  }
  blues.sort((a, b) => a - b);
  const bFg = blues.length ? blues[Math.floor(blues.length * 0.05)] : 0;

  // 按“白底 + 橙色前景”混合模型反解 alpha 并去白底(unblend)
  const out = Buffer.alloc(width * height * 4);
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let p = 0, i = 0; i < data.length; i += channels, p += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    let a = (255 - b) / (255 - bFg);
    a = Math.max(0, Math.min(1, a));
    let fr = 0, fg = 0, fb = 0;
    if (a > 0.001) {
      fr = Math.min(255, Math.max(0, Math.round((r - (1 - a) * 255) / a)));
      fg = Math.min(255, Math.max(0, Math.round((g - (1 - a) * 255) / a)));
      fb = Math.min(255, Math.max(0, Math.round((b - (1 - a) * 255) / a)));
    }
    const A = Math.round(a * 255);
    out[p] = fr; out[p + 1] = fg; out[p + 2] = fb; out[p + 3] = A;
    if (A > 10) {
      const px = i / channels;
      const x = px % width, y = Math.floor(px / width);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const pad = 6;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad); maxY = Math.min(height - 1, maxY + pad);

  await sharp(out, { raw: { width, height, channels: 4 } })
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .png()
    .toFile(`${ROOT}/brand/logo-wordmark.png`);
  console.log("wordmark ok", { bFg, crop: [minX, minY, maxX - minX + 1, maxY - minY + 1] });
}

async function makeIcon() {
  // lucide `sparkles` 图标路径(AI 助手页同款三十字星)
  const sparkles = [
    "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",
    "M20 3v4",
    "M22 5h-4",
    "M4 17v2",
    "M5 18H3",
  ].map((d) => `<path d="${d}"/>`).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#f07c00"/>
  <g transform="translate(101.2 101.2) scale(12.9)" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${sparkles}</g>
</svg>`;

  await sharp(Buffer.from(svg), { density: 300 })
    .resize(512, 512)
    .png()
    .toFile(`${ROOT}/app/icon.png`);
  console.log("icon ok");
}

extractWordmark().then(makeIcon).catch((e) => { console.error(e); process.exit(1); });
