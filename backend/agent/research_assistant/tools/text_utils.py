"""查询分词工具：统一处理中英文混合查询的分词逻辑。

背景问题
--------
中文查询（如「大语言模型」）没有空格分词边界。若按空白把整个查询当做一个
token，与英文摘要做子串匹配时几乎永远无法命中——「大语言模型」这个连续串
不会出现在英文论文的 title/abstract 里，导致中文查询零召回。

CJK 双字（bigram）分词原理
--------------------------
把连续汉字片段切成相邻两字组合：例如「大语言模型」→ [大语, 语言, 言模, 模型]。
只要摘要里出现其中任意一个双字组合（如「语言」），该查询即可命中；双字组合
同时也保留了局部语义顺序，比把每个单字当 token 的噪音小得多。对纯英文/数字
查询则按拉丁字符与数字提取单词，行为与原 whitespace split 一致。

函数返回去重且保序（首次出现顺序）的 token 列表。
"""
from __future__ import annotations

import re

# 拉丁字母/数字单词：首个字符后至少跟随一个字符（含连字符），如 transformer、gpt-4、3d
_LATIN_RE = re.compile(r"[a-z0-9][a-z0-9\-]{1,}")
# 连续汉字片段（CJK 统一表意文字）
_CJK_RE = re.compile(r"[\u4e00-\u9fff]+")


def _cjk_tokens(run: str) -> list[str]:
    """把一段连续汉字切成字符 bigram；单字片段直接保留。"""
    if len(run) == 1:
        return [run]
    return [run[i : i + 2] for i in range(len(run) - 1)]


def tokenize_query(text: str) -> list[str]:
    """把查询切成检索 token 列表：拉丁/数字词 + CJK 双字组合，去重保序。

    Args:
        text: 原始用户查询（可为中英混合）。

    Returns:
        去重后的 token 列表；无有效 token 时返回空列表。
    """
    tokens: list[str] = []
    for token in _LATIN_RE.findall(text.lower()):
        tokens.append(token)
    for run in _CJK_RE.findall(text):
        tokens.extend(_cjk_tokens(run))
    return list(dict.fromkeys(tokens))
