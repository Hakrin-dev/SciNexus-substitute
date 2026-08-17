# -*- coding: utf-8 -*-
"""
将「深知」瘦金体书法图片描摹为 SVG 矢量路径:
1. 灰度 + Otsu 二值化  2. 按上下两半分离深/知  3. findContours 描边
4. 缩放到 96 网格印章布局  5. 输出彩色/单色/反白/favicon 四个 SVG
"""
import os, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import cv2
import numpy as np

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '“深知”瘦金体.jpg')
OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# 印章布局:每个字的 target box(96 网格,与确认稿一致)
TILE = dict(x=6, y=6, w=84, h=84, rx=18)
BOX_SHEN = (34.0, 18.0, 28.0, 29.0)   # x, y, w, h —— 深
BOX_ZHI  = (33.0, 51.0, 30.0, 29.0)   # 知(口在右,整体略宽)

def load_binarized():
    img = cv2.imdecode(np.fromfile(SRC, dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
    assert img is not None, 'cannot read image'
    # 二值化:字为黑,底为白
    bw = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    return bw

def crop_content(bw, pad=6):
    ys, xs = np.where(bw > 0)
    y0, y1 = ys.min(), ys.max()
    x0, x1 = xs.min(), xs.max()
    x0 = max(0, x0 - pad); y0 = max(0, y0 - pad)
    x1 = min(bw.shape[1], x1 + pad); y1 = min(bw.shape[0], y1 + pad)
    return bw[y0:y1, x0:x1]

def trace(bw):
    """返回 [(points, is_hole)] 列表,points 为 Nx2 数组"""
    contours, hierarchy = cv2.findContours(bw, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if hierarchy is None:
        return []
    hierarchy = hierarchy[0]
    total_area = bw.shape[0] * bw.shape[1]
    out = []
    for i, cnt in enumerate(contours):
        area = cv2.contourArea(cnt)
        if area < total_area * 0.0004:   # 滤掉噪点
            continue
        approx = cv2.approxPolyDP(cnt, epsilon=1.1, closed=True)
        pts = approx.reshape(-1, 2).astype(float)
        is_hole = hierarchy[i][3] >= 0
        out.append((pts, is_hole))
    return out

def to_paths(traced, box, src_shape):
    """把描摹点集映射到 target box,输出 SVG path 字符串(偶奇填充处理孔洞)"""
    x, y, w, h = box
    sh, sw = src_shape
    scale = min(w / sw, h / sh)
    ox = x + (w - sw * scale) / 2
    oy = y + (h - sh * scale) / 2
    parts = []
    for pts, _ in traced:
        mapped = [(ox + px * scale, oy + py * scale) for px, py in pts]
        d = 'M' + 'L'.join(f'{px:.2f},{py:.2f}' for px, py in mapped) + 'Z'
        parts.append(d)
    return ''.join(f'<path d="{d}"/>' for d in parts)

def seal_svg(glyphs, tile_fill, glyph_fill):
    t = TILE
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">'
        f'<rect x="{t["x"]}" y="{t["y"]}" width="{t["w"]}" height="{t["h"]}" rx="{t["rx"]}" fill="{tile_fill}"/>'
        f'<g fill="{glyph_fill}" fill-rule="evenodd" stroke="none">{glyphs}</g>'
        '</svg>'
    )

def main():
    bw = load_binarized()
    H = bw.shape[0]
    # 按上下两半切分深/知(图片为两张扫描竖排拼接)
    half = H // 2
    shen = crop_content(bw[0:half, :])
    zhi = crop_content(bw[half:, :])
    print('深 crop:', shen.shape, ' 知 crop:', zhi.shape)

    g_shen = to_paths(trace(shen), BOX_SHEN, shen.shape)
    g_zhi = to_paths(trace(zhi), BOX_ZHI, zhi.shape)
    glyphs = g_shen + g_zhi

    BLUE, WHITE, INK, GOLD = '#002FA7', '#FFFFFF', '#0F1419', '#f3d029'
    assets = {
        'shenzhi-seal.svg': seal_svg(glyphs, BLUE, WHITE),
        'shenzhi-seal-mono.svg': seal_svg(glyphs, INK, WHITE),
        'shenzhi-seal-reverse.svg': seal_svg(glyphs, WHITE, BLUE),
    }
    for name, svg in assets.items():
        with open(os.path.join(OUT_DIR, name), 'w', encoding='utf-8') as f:
            f.write(svg)
        print('written:', name, len(svg), 'bytes')

    # 迭代预览页
    preview = f"""<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>深知印 · 书法描摹稿</title>
<style>*{{margin:0;padding:0;box-sizing:border-box}}body{{background:#F7F8FC;font-family:"PingFang SC","Microsoft YaHei",sans-serif;color:#0F1419;padding:40px 48px}}h1{{font-size:22px}}.row{{display:flex;align-items:flex-end;gap:40px;margin-top:32px;flex-wrap:wrap}}.item{{display:flex;flex-direction:column;align-items:center;gap:10px;font-size:12px;color:#6B7280}}.dark{{background:#0F1419;border-radius:12px;padding:12px}}</style></head><body>
<h1>深知印 · 瘦金体书法描摹稿(真迹矢量化)</h1>
<div class="row">
<div class="item"><img src="shenzhi-seal.svg" width="320" height="320">320px</div>
<div class="item"><img src="shenzhi-seal.svg" width="168" height="168">168px</div>
<div class="item"><img src="shenzhi-seal.svg" width="72" height="72">72px</div>
<div class="item"><img src="shenzhi-seal.svg" width="40" height="40">40px</div>
<div class="item"><img src="shenzhi-seal.svg" width="24" height="24">24px</div>
<div class="item"><img src="shenzhi-seal.svg" width="16" height="16">16px</div>
<div class="item dark"><img src="shenzhi-seal-reverse.svg" width="40" height="40">反白</div>
<div class="item"><img src="shenzhi-seal-mono.svg" width="40" height="40">单色墨</div>
<div class="item" style="background:#002FA7;border-radius:12px;padding:12px"><svg width="40" height="40" viewBox="0 0 96 96"><rect x="6" y="6" width="84" height="84" rx="18" fill="{GOLD}"/><g fill="{INK}">{glyphs.replace('<path', '<path transform="translate(0,0)"', 1)}</g></svg>金印(桂冠金 #f3d029)</div>
</div></body></html>"""
    with open(os.path.join(OUT_DIR, 'seal-trace-preview.html'), 'w', encoding='utf-8') as f:
        f.write(preview)
    print('written: seal-trace-preview.html')

if __name__ == '__main__':
    main()
