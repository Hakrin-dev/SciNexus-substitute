# 知识底座检索评测

`knowledge-retrieval.jsonl` 是当前浏览器验收后人工确认的最小基线集。每行包含查询、相关论文 ID 和 topK。

运行：

```bash
node scripts/evaluate-knowledge-retrieval.mjs evaluation/knowledge-retrieval.jsonl
```

指标包括 Recall@k、MRR、NDCG、P95、失败率和回退率。上线决策前应将该基线扩充为覆盖中文/英文、年份与会议筛选、远程异常回退的人工标注集；不得用模型自动生成的“相关性”当作金标准。
