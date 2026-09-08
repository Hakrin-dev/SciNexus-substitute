# Vercel 知识底座冒烟验证结果

- 时间(UTC): Tue Sep  8 04:58:46 UTC 2026

## 1. /api/knowledge/health
```json
{"success":true,"data":{"status":"ready","provider":"remote","source":"remote_knowledge_base","checkedAt":"2026-09-08T04:58:47.758Z","tookMs":537,"runtime":{"circuit":"closed","retryAt":null,"retryAfterMs":0,"requests":0,"successes":0,"failures":0,"fallbackRate":0,"p95Ms":null},"checks":{"service":{"ok":true,"data":{"ok":true,"time":"2026-09-08T04:58:48.102Z"}},"retrieval":{"ok":true,"data":{"status":"ok","components":["bm25","zilliz_dense","neo4j_filter"],"lexical":{"status":"ok","backend":"sqlite_fts5","paper_count":114763,"db_path":"/root/jiansuo/retrieval_backend/papers_fts.db"},"graph":{"status":"ok","paper_count":536241,"database":"neo4j"},"dense":{"status":"ready","collection":"paper_embedding_chunks_v1_1024"}}},"ready":{"ok":true,"data":{"status":"ok","components":["bm25","zilliz_dense","neo4j_filter"],"lexical":{"status":"ok","backend":"sqlite_fts5","paper_count":114763,"db_path":"/root/jiansuo/retrieval_backend/papers_fts.db"},"graph":{"status":"ok","paper_count":536241,"database":"neo4j"},"dense":{"status":"ready","collection":"paper_embedding_chunks_v1_1024"},"ready":true}}}}}
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
    "title": "Emotion Granularity from Text: An Aggregate-Level Indicator of Mental Health",
    "conference": null,
    "year": 2024,
    "pdfUrl": "https://aclanthology.org/2024.emnlp-main.1069.pdf"
  }
}
```

## 3. /api/v1/knowledge/search (graph neural network, top_k=3)
```json
{"success":true,"data":{"results":[{"paperId":"paper:11782_aaai:515867700446","title":"An End-to-End Deep Learning Architecture for Graph Classification","abstract":"Neural networks are typically designed to deal with data in tensor forms. In this paper, we propose a novel neural network architecture accepting graphs of arbitrary structure. Given a dataset containing graphs in the form of (G,y) where G is a graph and y is its class, we aim to develop neural networks that read the graphs directly and learn a classification function. There are two main challenges: 1) how to extract useful featur
```

## 4. /api/v1/knowledge/paper (详情, paperId 取自搜索结果)
```json
{"success":true,"data":{"paper":{"paperId":"paper:11782_aaai:515867700446","title":"An End-to-End Deep Learning Architecture for Graph Classification","abstract":"Neural networks are typically designed to deal with data in tensor forms. In this paper, we propose a novel neural network architecture accepting graphs of arbitrary structure. Given a dataset containing graphs in the form of (G,y) where G is a graph and y is its class, we aim to develop neural networks that read the graphs directly an
```

## 5. /api/v1/knowledge/graph (引用图谱, depth=1)
```json
{"success":true,"data":{"graph":{"rootId":"paper:11782_aaai:515867700446","nodes":[{"id":"paper:11782_aaai:515867700446","title":"","label":"","type":"Paper","year":2018,"authors":["Muhan Zhang","Zhicheng Cui","Marion Neumann","Yixin Chen"],"venue":"AAAI","abstract":"Neural networks are typically designed to deal with data in tensor forms. In this paper, we propose a novel neural network architect
```

## 6. /api/papers/{paperId}/pdf (服务端 PDF 代理)
```
HTTP 200, Content-Type: application/pdf, 大小: 722327 bytes
```

## 7. 首页
```
HTTP 200, 总耗时 0.147116s
```
