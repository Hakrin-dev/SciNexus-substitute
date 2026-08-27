/** 科研数据库演示数据 —— 仅前端原型,不连后端 */

export interface DbPaper {
  id: string;
  title: string;
  authors: string;
  venue: string;
  year: number;
  citations: number;
  field: string;
}

export interface DbScholar {
  id: string;
  name: string;
  affiliation: string;
  field: string;
  hIndex: number;
  papers: number;
}

export interface DbInstitution {
  id: string;
  name: string;
  country: string;
  field: string;
  scholars: number;
}

export interface DbBenchmark {
  id: string;
  name: string;
  task: string;
  metric: string;
  leader: string;
  score: string;
}

export const dbPapers: DbPaper[] = [
  { id: "db-p1", title: "Retrieval-Augmented Generation for Scientific Survey", authors: "Chen Y., Li S., Wang Z.", venue: "NeurIPS", year: 2025, citations: 312, field: "检索" },
  { id: "db-p2", title: "Self-Correction in Long-Form Academic Writing", authors: "Hakrin-dev, 陈研", venue: "ACL", year: 2025, citations: 156, field: "写作" },
  { id: "db-p3", title: "Cross-Paper Claim Alignment with Evidence Graphs", authors: "李识, Wang Z.", venue: "ICLR", year: 2024, citations: 421, field: "分析" },
  { id: "db-p4", title: "Agent Workflows for Reproducible Experiments", authors: "Kim J., 陈研", venue: "ICML", year: 2025, citations: 98, field: "代码" },
  { id: "db-p5", title: "Knowledge Graph Construction from PDF Corpora", authors: "Wang Z., Chen Y.", venue: "EMNLP", year: 2024, citations: 267, field: "分析" },
  { id: "db-p6", title: "Citation Intent Classification at Scale", authors: "Li S., Kim J.", venue: "SIGIR", year: 2023, citations: 540, field: "检索" },
];

export const dbScholars: DbScholar[] = [
  { id: "db-s1", name: "Chen Y.", affiliation: "清华大学", field: "信息检索", hIndex: 48, papers: 132 },
  { id: "db-s2", name: "Wang Z.", affiliation: "中科院自动化所", field: "自然语言处理", hIndex: 61, papers: 210 },
  { id: "db-s3", name: "Kim J.", affiliation: "KAIST", field: "机器学习", hIndex: 39, papers: 98 },
  { id: "db-s4", name: "李识", affiliation: "研枢实验室", field: "科学智能", hIndex: 22, papers: 54 },
  { id: "db-s5", name: "陈研", affiliation: "研枢实验室", field: "前端工程", hIndex: 17, papers: 41 },
];

export const dbInstitutions: DbInstitution[] = [
  { id: "db-i1", name: "清华大学", country: "中国", field: "综合 · 人工智能", scholars: 1820 },
  { id: "db-i2", name: "中科院自动化所", country: "中国", field: "模式识别", scholars: 640 },
  { id: "db-i3", name: "KAIST", country: "韩国", field: "电气工程", scholars: 910 },
  { id: "db-i4", name: "MIT CSAIL", country: "美国", field: "计算机科学", scholars: 1240 },
];

export const dbBenchmarks: DbBenchmark[] = [
  { id: "db-b1", name: "SciEval-2025", task: "科学推理", metric: "Accuracy", leader: "SciNexus-Large", score: "78.4%" },
  { id: "db-b2", name: "PaperQA-Bench", task: "文献问答", metric: "F1", leader: "RAG-Pro", score: "71.2%" },
  { id: "db-b3", name: "CiteGraph", task: "引文预测", metric: "Recall@10", leader: "GraphSAGE-S", score: "0.63" },
  { id: "db-b4", name: "SurveyGen", task: "综述生成", metric: "ROUGE-L", leader: "SciNexus-Pro", score: "0.59" },
];

export const DB_STATS = [
  { key: "papers", label: "论文", value: "1.24M", hint: "涵盖 2015–2026" },
  { key: "scholars", label: "学者", value: "386K", hint: "含画像与合作关系" },
  { key: "institutions", label: "机构", value: "12.7K", hint: "全球高校与实验室" },
  { key: "benchmarks", label: "基准", value: "4.8K", hint: "持续更新榜单" },
] as const;
