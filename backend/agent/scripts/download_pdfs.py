"""下载 server/data/mock_data.py 中论文的 PDF 到项目 server/data/pdfs/ 目录。

仅下载有明确 arXiv 对应版本的论文；其余论文（综述/虚构标题）跳过。
用法：python scripts/download_pdfs.py
"""
from __future__ import annotations

import sys
import time
import urllib.request
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from server.data.mock_data import PAPERS  # noqa: E402

# 论文 id -> arXiv id（仅有确定对应关系的才映射）
ARXIV_ID = {
    "p1": "1706.03762",  # Attention Is All You Need
    "p2": "1810.04805",  # BERT
    "p3": "2005.14165",  # GPT-3
    "p4": "2009.06732",  # Efficient Transformers: A Survey
    "p5": "1704.01212",  # GNN for Drug Discovery（Neural Message Passing for Quantum Chemistry）
    "p7": "2203.02155",  # InstructGPT / RLHF
    "p10": "2111.07759",  # AlphaFold2
    "p11": "2103.14030",  # Swin Transformer
}


def main() -> None:
    out_dir = PROJECT_ROOT / "server" / "data" / "pdfs"
    out_dir.mkdir(parents=True, exist_ok=True)
    for paper in PAPERS:
        pid = paper["id"]
        aid = ARXIV_ID.get(pid)
        if not aid:
            print(f"[skip] {pid} {paper['title']}（无对应 arXiv）")
            continue
        target = out_dir / f"{pid}.pdf"
        if target.exists() and target.stat().st_size > 1000:
            print(f"[ok] {pid} 已存在（{target.stat().st_size} 字节）")
            continue
        url = f"https://arxiv.org/pdf/{aid}.pdf"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=90) as resp, open(target, "wb") as f:
                f.write(resp.read())
            print(f"[ok] {pid} {paper['title']} -> {target.name}（{target.stat().st_size} 字节）")
        except Exception as e:
            print(f"[fail] {pid}: {type(e).__name__}: {e}")
        time.sleep(1.5)


if __name__ == "__main__":
    main()
