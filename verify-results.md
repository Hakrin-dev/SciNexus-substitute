# Vercel 知识底座冒烟验证结果

- 时间(UTC): Tue Sep  8 04:36:55 UTC 2026

## 1. /api/knowledge/health
```json
{"success":true,"data":{"status":"ready","provider":"remote","source":"remote_knowledge_base","checkedAt":"2026-09-08T04:36:57.802Z","tookMs":1431,"runtime":{"circuit":"closed","retryAt":null,"retryAfterMs":0,"requests":0,"successes":0,"failures":0,"fallbackRate":0,"p95Ms":null},"checks":{"service":{"ok":true,"data":{"ok":true,"time":"2026-09-08T04:36:59.137Z"}},"retrieval":{"ok":true,"data":{"status":"ok","components":["bm25","zilliz_dense","neo4j_filter"],"lexical":{"status":"ok","backend":"sqlite_fts5","paper_count":114763,"db_path":"/root/jiansuo/retrieval_backend/papers_fts.db"},"graph":{"status":"ok","paper_count":536241,"database":"neo4j"},"dense":{"status":"ready","collection":"paper_embedding_chunks_v1_1024"}}},"ready":{"ok":true,"data":{"status":"ok","components":["bm25","zilliz_dense","neo4j_filter"],"lexical":{"status":"ok","backend":"sqlite_fts5","paper_count":114763,"db_path":"/root/jiansuo/retrieval_backend/papers_fts.db"},"graph":{"status":"ok","paper_count":536241,"database":"neo4j"},"dense":{"status":"ready","collection":"paper_embedding_chunks_v1_1024"},"ready":true}}}}}
```

## 2. /api/v1/knowledge/discover (随机论文)
```json
{
  "success": true,
  "meta": {
    "source": "remote_knowledge_base",
    "random": true,
    "count": 10
  },
  "results_count": 10,
  "first_paper": {
    "id": null,
    "paper_id": null,
    "title": "Low-rank lottery tickets: finding efficient low-rank neural networks via matrix differential equations",
    "conference": null,
    "year": 2022,
    "pdfUrl": "https://openreview.net/pdf?id=IILJ0KWZMy9"
  }
}
```

## 3. /api/v1/knowledge/search (graph neural network, top_k=3)
```json
{"success":true,"data":{"results":[{"paperId":"paper:11782_aaai:515867700446","title":"An End-to-End Deep Learning Architecture for Graph Classification","abstract":"Neural networks are typically designed to deal with data in tensor forms. In this paper, we propose a novel neural network architecture accepting graphs of arbitrary structure. Given a dataset containing graphs in the form of (G,y) where G is a graph and y is its class, we aim to develop neural networks that read the graphs directly and learn a classification function. There are two main challenges: 1) how to extract useful featur
```

## 4. /api/v1/knowledge/paper (详情, paperId 取自搜索结果)
```json
NO_PAPER_ID_FROM_SEARCH

```

## 5. /api/v1/knowledge/graph (引用图谱, depth=1)
```json
NO_PAPER_ID_FROM_SEARCH

```

## 6. 首页
```
HTTP 200, 总耗时 0.260846s
```
