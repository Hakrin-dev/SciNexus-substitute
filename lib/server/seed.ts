/**
 * 数据库种子数据初始化脚本
 * 将前端 lib/data/*.ts 中的模拟数据写入 SQLite，启动时自动执行一次
 */
import { getDB, jsonStringify } from "./db";
import { hashPassword } from "./password";

// ====== 模拟数据（从 lib/data 中提取，避免循环依赖） ======

const feedPapers = [
  {
    id: "ultralong-1m",
    date: "2026-07-25",
    venue: "ICML 2026 · Oral",
    venue_tone: "violet",
    authors: "Wei-Lin Chiang · Zhuohan Li · et al. (UC Berkeley)",
    title: "UltraLong-1M: 一个面向百万级 Token 推理的自回归 Transformer 长程记忆机制",
    abstract:
      "UltraLong-1M 提出了一个分层的键值压缩与稀疏注意力机制,使 8B 参数的 Transformer 能在单张 H100 上稳定训练 1M Token 上下文。在 LongBench v2 与 RULER 上分别取得 78.3 与 91.4 分,相对 Llama-3-8B-1M 提升 12.7 分,训练成本下降 41%。",
    ai_link: "AI 深度解读",
    tags: ["长上下文", "Transformer", "稀疏注意力"],
    likes: 428,
    citations: 354,
    thumb: "论文摘要图",
    ccf: "A",
    year: 2026,
  },
  {
    id: "sana-video-2",
    date: "2026-07-24",
    venue: "arXiv · cs.CV",
    venue_tone: "amber",
    authors: "Junsong Chen · Jincheng Yu · Yitong Li (NVIDIA)",
    title: "SANA-Video 2.0: 基于混合线性注意力与残差机制的高效视频扩散 Transformer",
    abstract:
      "NVIDIA 的 SANA-Video 2.0 引入混合线性注意力与周期性 softmax 锚点机制,5B 参数模型在单张 H100 GPU 上 13.2 秒生成 81 帧视频,VBench 总分 84.30,相对全 softmax 基线实现 3.2 倍 DiT 前向加速。",
    ai_link: "查看解读",
    tags: ["视频生成", "扩散模型", "线性注意力"],
    likes: 196,
    citations: 293,
    thumb: "视频生成架构图",
    ccf: "预印本",
    year: 2026,
  },
  {
    id: "arex",
    date: "2026-07-23",
    venue: "ICLR 2026",
    venue_tone: "green",
    authors: "Yifei Ming · Sumanth Dathathri · et al. (Stanford)",
    title: "AREX: 面向深度研究的递归自我进化智能体",
    abstract:
      "AREX 提出了一种递归自进化机制:智能体在每次研究循环后自动重写自身的工具策略与检索流程,连续 4 轮迭代后在 DeepResearch Bench 上达到 73.8 分,相对静态智能体基线提升 19.2 分。",
    ai_link: "智能体实验记录",
    tags: ["智能体", "递归学习"],
    likes: 112,
    citations: 218,
    thumb: "智能体流程图",
    ccf: "A",
    year: 2026,
  },
  {
    id: "rdt-1b",
    date: "2026-07-20",
    venue: "ICML 2026",
    venue_tone: "violet",
    authors: "Songming Liu, Lingxuan Wu, Bangguo Li, et al.",
    title: "RDT-1B: A Diffusion Foundation Model for Robotic Manipulation",
    abstract:
      "We introduce RDT (Robotics Diffusion Transformer), a diffusion foundation model for robotic manipulation. RDT is pre-trained on the largest multi-robot dataset to date (DROID, 1.0M+ trajectories) and then fine-tuned on a target robot.",
    ai_link: "AI 深度解读",
    tags: ["机器人", "扩散模型", "基础模型"],
    likes: 428,
    citations: 312,
    thumb: "论文架构图",
    ccf: "A",
    year: 2026,
  },
];

const scholars = [
  {
    id: "kaiming-he",
    name_cn: "何恺明",
    name_en: "Kaiming He",
    initials: "KH",
    avatar_color: "#002FA7",
    role: "副教授",
    affiliation: "MIT EECS · Google DeepMind Distinguished Scientist",
    bio: "ResNet 作者之一,提出了残差连接使训练百层深度网络成为可能;Masked Autoencoders (MAE) 通过像素重建推动视觉自监督学习。",
    citations: "849k",
    h_index: 77,
    tags: ["计算机视觉", "深度学习", "表征学习"],
    location: "美国 · 马萨诸塞州剑桥",
    email: "kaiming@mit.edu",
  },
  {
    id: "geoffrey-hinton",
    name_cn: "Geoffrey Hinton",
    name_en: "杰弗里 · 辛顿",
    initials: "GH",
    avatar_color: "#10B981",
    role: "荣誉教授",
    affiliation: "多伦多大学 · 2024 诺贝尔物理学奖得主",
    bio: "深度学习之父,ImageNet 分类竞赛中使用 CNN 与 GPU 加速实现大规模图像识别;反向传播算法的共同发明人之一。",
    citations: "1.1M",
    h_index: 192,
    tags: ["机器学习", "神经网络", "认知心理学"],
  },
  {
    id: "yoshua-bengio",
    name_cn: "Yoshua Bengio",
    name_en: "约书亚 · 本吉奥",
    initials: "YB",
    avatar_color: "#F59E0B",
    role: "全职教授",
    affiliation: "蒙特利尔大学 · Mila 创始人",
    bio: "GAN 生成式对抗网络的共同提出者,使生成模型通过两个神经网络的对抗训练得以发展;深度学习三巨头之一。",
    citations: "1.1M",
    h_index: 256,
    tags: ["机器学习", "深度学习", "NLP"],
  },
  {
    id: "fei-fei-li",
    name_cn: "李飞飞",
    name_en: "Fei-Fei Li",
    initials: "FL",
    avatar_color: "#EC4899",
    role: "教授",
    affiliation: "斯坦福大学 · 斯坦福 AI Lab 前主任",
    bio: "ImageNet 与 ImageNet Challenge 创始人,推动了大规模视觉数据集与深度学习结合;现从事空间智能与具身 AI 研究。",
    citations: "395k",
    h_index: 168,
    tags: ["计算机视觉", "具身智能", "数据集构建"],
  },
  {
    id: "pieter-abbeel",
    name_cn: "Pieter Abbeel",
    name_en: "阿比希尔",
    initials: "PA",
    avatar_color: "#8B5CF6",
    role: "教授",
    affiliation: "UC Berkeley · Covariant 创始人",
    bio: "强化学习与机器人学先驱,提出 TRPO/GAE 等算法奠定策略梯度基础;近年专注于工业机器人的通用基础模型。",
    citations: "186k",
    h_index: 94,
    tags: ["强化学习", "机器人学", "策略学习"],
  },
  {
    id: "ilya-sutskever",
    name_cn: "Ilya Sutskever",
    name_en: "伊利亚",
    initials: "IS",
    avatar_color: "#06B6D4",
    role: "联合创始人",
    affiliation: "Safe Superintelligence Inc.",
    bio: "OpenAI 前首席科学家,ImageNet 分类核心贡献者;与 Sutskever 一起推动 AlexNet 引入 GPU 训练,开启深度学习革命。",
    citations: "830k",
    h_index: 102,
    tags: ["机器学习", "神经网络", "AI 安全"],
  },
];

const scholarPublications: Record<string, any[]> = {
  "kaiming-he": [
    {
      id: "resnet",
      title: "Deep Residual Learning for Image Recognition",
      abstract:
        "Deeper neural networks are more difficult to train. We present a residual learning framework to ease the training of networks that are substantially deeper than those used previously.",
      authors: "Kaiming He, Xiangyu Zhang, Shaoqing Ren, Jian Sun",
      venue: "CVPR 2016",
      citations: "引用 218k",
      citations_short: "12k",
    },
    {
      id: "mae",
      title: "Masked Autoencoders Are Scalable Vision Learners",
      abstract:
        "This paper shows that masked autoencoders (MAE) are scalable self-supervised learners for computer vision.",
      authors: "Kaiming He, Xinlei Chen, Saining Xie, Yanghao Li, Piotr Dollár, Ross Girshick",
      venue: "CVPR 2022",
      citations: "引用 14.5k",
      citations_short: "3.2k",
    },
    {
      id: "meanflow",
      title: "Improved Mean Flows: On the Challenges of Fastforward Generative Models",
      abstract: "MeanFlow (MF) has recently been established as a framework for one-step generative modeling.",
      authors: "Zhengyang Geng, Yiyang Lu, Zongze Wu + 3 more",
      venue: "2026",
      citations: "引用 158",
      citations_short: "39",
    },
  ],
};

const scholarYearlyCitations: Record<string, { years: string[]; values: number[] }> = {
  "kaiming-he": {
    years: ["2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"],
    values: [3200, 5100, 8400, 12600, 18900, 24500, 31200, 38900, 44100, 52300, 58800, 63481],
  },
};

const institutions = [
  {
    id: "tsinghua",
    name_cn: "清华大学",
    name_en: "Tsinghua University",
    initials: "THU",
    logo_color: "#002FA7",
    type: "高校",
    location: "中国 · 北京",
    intro:
      "清华大学计算机系始建于 1958 年,是国内计算机学科的发源地之一。在人工智能领域拥有智能技术与系统国家重点实验室、清华 AI 研究院(THUAI)等平台。",
    stats: [
      { label: "研究人员", value: "3,800+" },
      { label: "年论文", value: "1,200+" },
      { label: "总引用", value: "2.4M" },
      { label: "国家级平台", value: "12" },
    ],
    fields: ["大语言模型", "计算机视觉", "类脑计算", "具身智能"],
    highlight: "代表性成果:GLM 系列大模型、天机芯类脑芯片(《Nature》封面)。",
    bookmarked: 1,
    rank: 1,
    papers_per_year: 1200,
  },
  {
    id: "cas-ict",
    name_cn: "中科院计算技术研究所",
    name_en: "Institute of Computing Technology, CAS",
    initials: "ICT",
    logo_color: "#0E7490",
    type: "研究院",
    location: "中国 · 北京",
    intro:
      "中科院计算所成立于 1956 年,是中国计算机事业的摇篮,研制了我国第一台通用数字电子计算机。孵化了联想、曙光、寒武纪等企业。",
    stats: [
      { label: "研究人员", value: "1,600+" },
      { label: "年论文", value: "600+" },
      { label: "总引用", value: "890k" },
      { label: "国家级平台", value: "8" },
    ],
    fields: ["AI 芯片", "智能计算系统", "体系结构", "数据科学"],
    highlight: "代表性成果:寒武纪系列 AI 处理器、龙芯 CPU。",
    rank: 4,
    papers_per_year: 600,
  },
  {
    id: "pku",
    name_cn: "北京大学",
    name_en: "Peking University",
    initials: "PKU",
    logo_color: "#B91C1C",
    type: "高校",
    location: "中国 · 北京",
    intro:
      "北京大学信息科学技术学院与智能学院在机器学习理论、计算机视觉、自然语言处理方向实力雄厚。近年依托北京通用人工智能研究院(BIGAI)在通用人工智能方向布局深入。",
    stats: [
      { label: "研究人员", value: "2,900+" },
      { label: "年论文", value: "900+" },
      { label: "总引用", value: "1.6M" },
      { label: "国家级平台", value: "9" },
    ],
    fields: ["机器学习理论", "多模态理解", "NLP", "智能系统"],
    highlight: "代表性成果:汉字激光照排系统、通用智能体 Tong 系列。",
    rank: 3,
    papers_per_year: 900,
  },
  {
    id: "mit-csail",
    name_cn: "MIT 计算机科学与人工智能实验室",
    name_en: "MIT CSAIL",
    initials: "CSAIL",
    logo_color: "#A31F34",
    type: "高校",
    location: "美国 · 剑桥",
    intro:
      "CSAIL 是 MIT 最大的跨学科实验室,由 1963 年的 Project MAC 演变而来,2003 年合并 AI Lab 与 LCS 而成。",
    stats: [
      { label: "研究人员", value: "1,700+" },
      { label: "年论文", value: "800+" },
      { label: "总引用", value: "3.1M" },
      { label: "国家级平台", value: "15" },
    ],
    fields: ["机器人", "表征学习", "系统与网络", "计算理论"],
    highlight: "代表性成果:ResNet(何恺明)、RSA 加密算法、World Wide Web 发源地之一。",
    rank: 2,
    papers_per_year: 800,
  },
  {
    id: "stanford-sail",
    name_cn: "斯坦福人工智能实验室",
    name_en: "Stanford AI Lab (SAIL)",
    initials: "SAIL",
    logo_color: "#8C1515",
    type: "高校",
    location: "美国 · 斯坦福",
    intro:
      "SAIL 由 John McCarthy 于 1963 年创立,是人工智能学科的发源地之一('Artificial Intelligence'一词的诞生地)。",
    stats: [
      { label: "研究人员", value: "900+" },
      { label: "年论文", value: "500+" },
      { label: "总引用", value: "2.2M" },
      { label: "国家级平台", value: "7" },
    ],
    fields: ["基础模型", "机器人学习", "AI 医疗", "计算机视觉"],
    highlight: "代表性成果:ImageNet、HELM 基础模型评测体系、Stanford Doggo 机器人。",
    rank: 5,
    papers_per_year: 500,
  },
  {
    id: "deepmind",
    name_cn: "Google DeepMind",
    name_en: "Google DeepMind",
    initials: "DM",
    logo_color: "#4285F4",
    type: "企业实验室",
    location: "英国 · 伦敦",
    intro:
      "DeepMind 2010 年成立于伦敦,2014 年被 Google 收购,2023 年与 Google Brain 合并为 Google DeepMind。以 AlphaGo、AlphaFold 闻名。",
    stats: [
      { label: "研究人员", value: "2,500+" },
      { label: "年论文", value: "700+" },
      { label: "总引用", value: "1.9M" },
      { label: "国家级平台", value: "—" },
    ],
    fields: ["强化学习", "蛋白质结构预测", "基础模型", "AI for Science"],
    highlight: "代表性成果:AlphaGo、AlphaFold(诺贝尔化学奖)、Gemini 系列。",
    rank: 6,
    papers_per_year: 700,
  },
  {
    id: "openai",
    name_cn: "OpenAI",
    name_en: "OpenAI",
    initials: "OAI",
    logo_color: "#10A37F",
    type: "企业实验室",
    location: "美国 · 旧金山",
    intro:
      "OpenAI 2015 年由 Sam Altman、Elon Musk、Ilya Sutskever 等创立,GPT 系列模型开启了生成式 AI 时代。",
    stats: [
      { label: "研究人员", value: "1,200+" },
      { label: "年论文", value: "200+" },
      { label: "总引用", value: "1.4M" },
      { label: "国家级平台", value: "—" },
    ],
    fields: ["大语言模型", "对齐与安全", "多模态", "智能体"],
    highlight: "代表性成果:GPT 系列、ChatGPT、DALL·E、Sora。",
    bookmarked: 1,
    rank: 7,
    papers_per_year: 200,
  },
  {
    id: "mila",
    name_cn: "Mila 魁北克人工智能研究所",
    name_en: "Mila - Quebec AI Institute",
    initials: "MILA",
    logo_color: "#F59E0B",
    type: "研究院",
    location: "加拿大 · 蒙特利尔",
    intro:
      "Mila 由图灵奖得主 Yoshua Bengio 于 1993 年创立,是全球最大的深度学习学术研究中心之一。",
    stats: [
      { label: "研究人员", value: "1,000+" },
      { label: "年论文", value: "450+" },
      { label: "总引用", value: "980k" },
      { label: "国家级平台", value: "3" },
    ],
    fields: ["深度学习", "因果推断", "生成模型", "AI 公益应用"],
    highlight: "代表性成果:GAN 早期工作、神经机器翻译注意力机制奠基性论文。",
    rank: 8,
    papers_per_year: 450,
  },
];

const venues = [
  {
    id: "dai-2026",
    kind: "conference",
    abbr: "DAI",
    full_name: "International Conference on Distributed Artificial Intelligence",
    badges: ["CCF C"],
    meta_rows: [
      [
        ["folder", "人工智能"],
        ["pin", "Hong Kong, China"],
        ["cal", "November 29-December 2, 2026"],
      ],
    ],
    chips: [],
    accent: "danger",
    deadline_label: "摘要截止",
    deadline_date: "2026年7月28日 19:59",
    deadline_offset_ms: 28 * 60_000 + 11_000,
    domain: "人工智能",
    acceptance_rate: 0.24,
    match_pct: 65,
  },
  {
    id: "aaai-2027",
    kind: "conference",
    abbr: "AAAI",
    full_name: "AAAI人工智能会议",
    badges: ["CCF A", "CORE A*", "TH-CPL A", "CSRanking", "CAAI A"],
    meta_rows: [
      [
        ["folder", "人工智能"],
        ["chart", "2026录用率: 17.6%"],
        ["pin", "Montréal, Québec, Canada"],
        ["cal", "February 16-23, 2027"],
        ["quote", "平均引用: 8.09964"],
      ],
    ],
    chips: ["Artificial Intelligence", "Machine Learning", "Knowledge Representation", "Planning"],
    accent: "success",
    deadline_label: "全文截止",
    deadline_date: "2026年7月29日 19:59",
    deadline_offset_ms: 24 * 3600_000 + 28 * 60_000 + 11_000,
    domain: "人工智能",
    acceptance_rate: 0.176,
    match_pct: 88,
  },
  {
    id: "hpca-2027",
    kind: "conference",
    abbr: "HPCA",
    full_name: "IEEE International Symposium on High-Performance Computer Architecture",
    badges: ["CCF A", "CORE A*", "TH-CPL B", "CAAI C"],
    meta_rows: [
      [
        ["folder", "计算机体系结构/并行与分布计算/存储系统"],
        ["chart", "2026录用率: 19.8%"],
      ],
      [
        ["pin", "Salt Lake City, Utah, USA"],
        ["cal", "March 20-24, 2027"],
        ["quote", "平均引用: 18.5792"],
      ],
    ],
    chips: ["Computer Architecture", "Parallel Computing", "Storage Systems"],
    accent: "success",
    deadline_label: "全文截止",
    deadline_date: "2026年8月1日 19:59",
    deadline_offset_ms: 4 * 24 * 3600_000 + 28 * 60_000 + 11_000,
    domain: "计算机体系结构",
    acceptance_rate: 0.198,
    match_pct: 72,
  },
  {
    id: "ieee-tkde",
    kind: "journal",
    abbr: "IEEE TKDE",
    full_name: "IEEE Transactions on Knowledge and Data Engineering",
    badges: ["CCF A", "TH-CPL B", "CAAI A", "中科院1区", "JCR Q1", "高质量期刊 T1"],
    meta_rows: [
      [
        ["folder", "数据库/数据挖掘/内容检索"],
        ["quote", "平均引用: 15.8638"],
      ],
    ],
    chips: ["Data Mining", "Knowledge Engineering", "Database Systems", "Big Data"],
    accent: "success",
    domain: "数据挖掘",
    match_pct: 85,
  },
  {
    id: "ieee-tpami",
    kind: "journal",
    abbr: "IEEE TPAMI",
    full_name: "IEEE Transactions on Pattern Analysis and Machine Intelligence",
    badges: ["CCF A", "TH-CPL B", "CAAI A", "中科院1区", "JCR Q1", "高质量期刊 T1"],
    meta_rows: [
      [
        ["folder", "人工智能"],
        ["quote", "平均引用: 16.2350"],
      ],
    ],
    chips: ["Computer Vision", "Pattern Recognition", "Machine Learning", "Deep Learning"],
    accent: "success",
    domain: "人工智能",
    match_pct: 90,
  },
];

const graphNodesPublic = [
  { id: "liu-2024", label_lines: ["Liu", "2024"], weight: 1, year: 2024, title: "RDT-1B: A Diffusion Foundation Model for Robotic Manipulation", authors: "Songming Liu, Lingxuan Wu, Bangguo Li, et al.", venue: "arXiv", citations: "引用 312", abstract: "RDT (Robotics Diffusion Transformer) 论文...", paper_id: "rdt-1b" },
  { id: "chi-2023", label_lines: ["Chi", "2023"], weight: 0.95, year: 2023, title: "Diffusion Policy: Visuomotor Policy Learning via Action Diffusion", authors: "Cheng Chi, Siyuan Feng, Yilun Du, et al.", venue: "CoRL 2023", citations: "引用 1.8k", abstract: "We introduce Diffusion Policy..." },
  { id: "kim-2024", label_lines: ["Kim", "2024"], weight: 0.8, year: 2024, title: "OpenVLA: An Open-Source Vision-Language-Action Model", authors: "Moo Jin Kim, Karl Pertsch, et al.", venue: "CoRL 2024", citations: "引用 890", abstract: "OpenVLA is a 7B-parameter..." },
  { id: "ze-2024", label_lines: ["Ze", "2024"], weight: 0.72, year: 2024, title: "3D Diffusion Policy", authors: "Yanjie Ze, Gu Zhang, et al.", venue: "RSS 2024", citations: "引用 642", abstract: "DP3 incorporates 3D visual..." },
  { id: "black-2024", label_lines: ["Black", "2024"], weight: 0.7, year: 2024, title: "π0: A Vision-Language-Action Flow Model", authors: "Kevin Black, Noah Brown, et al.", venue: "arXiv 2024", citations: "引用 460", abstract: "We introduce π0..." },
  { id: "ghosh-2024", label_lines: ["Ghosh", "2024"], weight: 0.68, year: 2024, title: "Octo: An Open-Source Generalist Robot Policy", authors: "Dibya Ghosh, Homer Walke, et al.", venue: "RSS 2024", citations: "引用 520", abstract: "Octo is an open-source transformer..." },
  { id: "khazatsky-2024", label_lines: ["Khazatsky", "2024"], weight: 0.65, year: 2024, title: "DROID: A Large-Scale In-the-Wild Robot Manipulation Dataset", authors: "Alexander Khazatsky, Karl Pertsch, et al.", venue: "ICRA 2024", citations: "引用 380", abstract: "DROID is a diverse robot..." },
  { id: "brohan-2023", label_lines: ["Brohan", "2023"], weight: 0.6, year: 2023, title: "RT-2: Vision-Language-Action Models Transfer Web Knowledge", authors: "Anthony Brohan, Noah Brown, et al.", venue: "CoRL 2023", citations: "引用 1.5k", abstract: "RT-2 co-fine-tunes vision-language..." },
  { id: "wen-2026", label_lines: ["Wen", "2026"], weight: 0.55, year: 2026, title: "DexMamba: 面向灵巧手控制的视觉状态空间扩散模型", authors: "Yuxuan Wen, Zhaohui Li, et al.", venue: "arXiv 2026", citations: "引用 89", abstract: "DexMamba combines selective..." },
  { id: "ho-2020", label_lines: ["Ho", "2020"], weight: 0.5, year: 2020, title: "Denoising Diffusion Probabilistic Models", authors: "Jonathan Ho, Ajay Jain, Pieter Abbeel", venue: "NeurIPS 2020", citations: "引用 12k", abstract: "We present high-quality image..." },
  { id: "vaswani-2017", label_lines: ["Vaswani", "2017"], weight: 0.45, year: 2017, title: "Attention Is All You Need", authors: "Ashish Vaswani, Noam Shazeer, et al.", venue: "NeurIPS 2017", citations: "引用 128k", abstract: "We propose the Transformer..." },
  { id: "fu-2024", label_lines: ["Fu", "2024"], weight: 0.42, year: 2024, title: "Mobile ALOHA: Learning Bimanual Mobile Manipulation", authors: "Zipeng Fu, Tony Z. Zhao, Chelsea Finn", venue: "RSS 2024", citations: "引用 410", abstract: "Mobile ALOHA extends..." },
  { id: "song-2021", label_lines: ["Song", "2021"], weight: 0.38, year: 2021, title: "Score-Based Generative Modeling through Stochastic Differential Equations", authors: "Yang Song, Jascha Sohl-Dickstein, et al.", venue: "ICLR 2021", citations: "引用 6.4k", abstract: "We present a stochastic..." },
  { id: "zhao-2023", label_lines: ["Zhao", "2023"], weight: 0.35, year: 2023, title: "Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware", authors: "Tony Z. Zhao, Vikash Kumar, et al.", venue: "RSS 2023", citations: "引用 690", abstract: "ALOHA is a low-cost bimanual..." },
  { id: "reed-2022", label_lines: ["Reed", "2022"], weight: 0.3, year: 2022, title: "A Generalist Agent", authors: "Scott Reed, Konrad Żołna, et al.", venue: "TMLR 2022", citations: "引用 2.1k", abstract: "Gato is a single generalist..." },
];

const graphEdgesPublic = [
  ["liu-2024", "chi-2023", 0.95],
  ["liu-2024", "kim-2024", 0.8],
  ["liu-2024", "ze-2024", 0.72],
  ["liu-2024", "black-2024", 0.7],
  ["liu-2024", "ghosh-2024", 0.68],
  ["liu-2024", "khazatsky-2024", 0.65],
  ["liu-2024", "brohan-2023", 0.6],
  ["liu-2024", "wen-2026", 0.55],
  ["liu-2024", "ho-2020", 0.5],
  ["liu-2024", "vaswani-2017", 0.45],
  ["liu-2024", "fu-2024", 0.42],
  ["liu-2024", "song-2021", 0.38],
  ["liu-2024", "zhao-2023", 0.35],
  ["liu-2024", "reed-2022", 0.3],
  ["chi-2023", "ze-2024", 0.8],
  ["ho-2020", "song-2021", 0.7],
  ["zhao-2023", "fu-2024", 0.85],
  ["vaswani-2017", "brohan-2023", 0.5],
  ["kim-2024", "ghosh-2024", 0.6],
  ["black-2024", "chi-2023", 0.55],
];

const graphRelatedIdsPublic = [
  "chi-2023", "kim-2024", "ze-2024", "black-2024", "ghosh-2024",
  "khazatsky-2024", "brohan-2023", "wen-2026", "ho-2020",
  "vaswani-2017", "fu-2024", "song-2021", "zhao-2023", "reed-2022",
];

const graphNodesPrivate = [
  { id: "m1", label_lines: ["扩散策略", "2025"], weight: 0.9, year: 2025, title: "Hierarchical Diffusion Policies for Contact-Rich Manipulation", authors: "陈知行, 王璐, 李慕白", venue: "ICRA 2026(under review)", citations: "预印本", abstract: "We propose a hierarchical diffusion policy...", layer: "mine" },
  { id: "m2", label_lines: ["机器人基础模型", "2024"], weight: 0.72, year: 2024, title: "Cross-Embodiment Pretraining for Robot Foundation Models", authors: "陈知行, 李慕白, 赵启明", venue: "arXiv 2024", citations: "引用 86", abstract: "A masked action-modeling pretraining...", layer: "mine" },
  { id: "m3", label_lines: ["视觉伺服", "2022"], weight: 0.48, year: 2022, title: "Visual Servoing via Learned Keypoint Affordances", authors: "陈知行, 吴桐", venue: "IROS 2022", citations: "引用 41", abstract: "We learn dense keypoint affordance...", layer: "mine" },
  { id: "f7", label_lines: ["机器人学习", "2024"], weight: 0.85, year: 2024, title: "RDT-1B: A Diffusion Foundation Model", authors: "Songming Liu, Lingxuan Wu, et al.", venue: "arXiv 2024", citations: "引用 312", abstract: "RDT 论文...", paper_id: "rdt-1b", layer: "folder" },
  { id: "f1", label_lines: ["扩散模型", "2025"], weight: 0.8, year: 2025, title: "Diffusion Models for Iterative Video Frame Interpolation", authors: "Zhang Wei, Chen Li, Wang Ming", venue: "CVPR 2025", citations: "引用 96", abstract: "We formulate video frame...", layer: "folder" },
  { id: "f3", label_lines: ["长上下文", "2025"], weight: 0.7, year: 2025, title: "Long-Context Reasoning in Foundation Models", authors: "Wang Hao, Liu Yang, Zhou Tong", venue: "ICLR 2025", citations: "引用 54", abstract: "A hierarchical memory architecture...", layer: "folder" },
  { id: "f2", label_lines: ["智能体", "2024"], weight: 0.65, year: 2024, title: "LLM Agents for Autonomous Scientific Discovery", authors: "Li Ming, Chen Hao, Liu Yu", venue: "NeurIPS 2024", citations: "引用 73", abstract: "We benchmark LLM agents...", layer: "folder" },
  { id: "f8", label_lines: ["世界模型", "2025"], weight: 0.6, year: 2025, title: "World Models for Embodied Planning: A Survey", authors: "Sun Qi, Deng Rui, Fan Yu", venue: "TMLR 2025", citations: "引用 12", abstract: "A systematic survey of learned world models...", layer: "folder" },
  { id: "f4", label_lines: ["视频生成", "2025"], weight: 0.55, year: 2025, title: "SANA-Video 2.0: Efficient Video Diffusion", authors: "Junsong Chen, Jincheng Yu, Yitong Li", venue: "arXiv 2026", citations: "引用 31", abstract: "Hybrid linear attention...", layer: "folder" },
  { id: "f5", label_lines: ["Transformer", "2023"], weight: 0.5, year: 2023, title: "Efficient Transformers for Long-Sequence Modeling", authors: "Guo Liang, Shen Yao", venue: "ACM CSUR 2023", citations: "引用 210", abstract: "We taxonomize efficient transformer...", layer: "folder" },
  { id: "f6", label_lines: ["强化学习", "2024"], weight: 0.45, year: 2024, title: "Offline RL Fine-tuning for Real-Robot Policy Adaptation", authors: "Han Xu, Qian Zhao", venue: "ICML 2024", citations: "引用 38", abstract: "A conservative offline RL recipe...", layer: "folder" },
  { id: "f9", label_lines: ["状态空间", "2024"], weight: 0.4, year: 2024, title: "Mamba: Linear-Time Sequence Modeling with Selective State Spaces", authors: "Albert Gu, Tri Dao", venue: "COLM 2024", citations: "引用 1.2k", abstract: "Selective state-space models...", layer: "folder" },
];

const graphEdgesPrivate = [
  ["m1", "m2", 0.7, 0],
  ["m2", "m3", 0.45, 0],
  ["f1", "f4", 0.65, 0],
  ["f2", "f3", 0.5, 0],
  ["f5", "f9", 0.6, 0],
  ["f8", "f7", 0.55, 0],
  ["m1", "f7", 0.9, 1],
  ["m1", "f1", 0.6, 1],
  ["m2", "f7", 0.7, 1],
  ["m2", "f8", 0.5, 1],
  ["m3", "f6", 0.4, 1],
];

const graphRelatedIdsPrivate = ["m2", "m3", "f7", "f1", "f3", "f2", "f8", "f4", "f5", "f6", "f9"];

const defaultLibraryItems = [
  { id: "lib-1", title: "Diffusion Models for Iterative Video Frame Interpolation", venue: "CVPR 2025", arxiv: "arXiv:2406.12345", authors: "Zhang Wei, Chen Li, Wang Ming", pdf_tone: "violet", folder: "在读" },
  { id: "lib-2", title: "LLM Agents for Autonomous Scientific Discovery", venue: "NeurIPS 2024", arxiv: "arXiv:2411.08901", authors: "Li Ming, Chen Hao, Liu Yu", pdf_tone: "amber", folder: "在读" },
  { id: "lib-3", title: "Long-Context Reasoning in Foundation Models", venue: "ICLR 2025", arxiv: "arXiv:2501.04567", authors: "Wang Hao, Liu Yang, Zhou Tong", pdf_tone: "green", folder: "在读" },
];

const defaultLibraryFolders = [
  { name: "我的发表", count: 3 },
  { name: "想读", count: 8 },
  { name: "在读", count: 12, active: 1 },
  { name: "已读", count: 47 },
  { name: "归档", count: 23 },
];

const defaultNotifications = [
  { id: "n1", type: "deadline", title: "AAAI 2027 截稿提醒", desc: "全文截止 7月29日 19:59", time: "2小时前", icon: "calendar" },
  { id: "n2", type: "paper", title: "RDT-1B 有新引用", desc: "被 ICML 2026 论文引用", time: "昨天", icon: "doc" },
  { id: "n3", type: "follow", title: "何恺明发表新论文", desc: "MeanFlow — Fastforward 生成模型挑战", time: "3天前", icon: "user" },
];

// ====== 初始化执行函数 ======
function parseCitationCount(s: string | null): number {
  if (!s) return 0;
  const m = String(s)
    .toLowerCase()
    .trim()
    .replace(/,/g, "")
    .match(/^([\d.]+)([km]?)$/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  if (m[2] === "k") return Math.round(n * 1000);
  if (m[2] === "m") return Math.round(n * 1_000_000);
  return Math.round(n);
}

export function runSeed() {
  const db = getDB();
  const tx = db.transaction(() => {
    // ---- 检查是否已初始化（只要 papers 表有数据就跳过） ----
    const paperCount = (db.prepare("SELECT COUNT(*) as n FROM papers").get() as any).n;
    if (paperCount > 0) {
      console.log("[seed] 数据库已有数据，跳过初始化");
      return;
    }

    console.log("[seed] 开始写入种子数据...");

    // ---- 用户（默认演示用户） ----
    const hash = hashPassword("yanshu123");
    db.prepare(
      `INSERT OR IGNORE INTO users (id, username, email, password_hash, display_name, avatar_color)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run("user_demo", "hankairun", "hankairun@example.com", hash, "韩凯润", "#5046E5");

    // ---- 论文 ----
    const insertPaper = db.prepare(
      `INSERT INTO papers (id, date, venue, venue_tone, authors, title, abstract, ai_link, tags_json, likes, citations, thumb, ccf, year)
       VALUES (@id, @date, @venue, @venue_tone, @authors, @title, @abstract, @ai_link, @tags_json, @likes, @citations, @thumb, @ccf, @year)`
    );
    // FTS5 全文索引同步（可选能力，表不存在时跳过）
    let insertFts: any = null;
    try {
      insertFts = db.prepare(
        `INSERT INTO papers_fts (id, title, abstract, tags) VALUES (?, ?, ?, ?)`
      );
    } catch {}
    for (const p of feedPapers) {
      insertPaper.run({
        id: p.id,
        date: p.date ?? null,
        venue: p.venue ?? null,
        venue_tone: p.venue_tone ?? null,
        authors: p.authors ?? null,
        title: p.title ?? null,
        abstract: p.abstract ?? null,
        ai_link: p.ai_link ?? null,
        tags_json: jsonStringify(p.tags ?? []),
        likes: p.likes ?? 0,
        citations: p.citations ?? 0,
        thumb: p.thumb ?? null,
        ccf: p.ccf ?? null,
        year: p.year ?? null,
      });
      if (insertFts) {
        try {
          insertFts.run(p.id, p.title, p.abstract, (p.tags || []).join(" "));
        } catch {}
      }
    }

    // ---- 学者 ----
    const insertScholar = db.prepare(
      `INSERT INTO scholars (id, name_cn, name_en, initials, avatar_color, role, affiliation, bio, citations, citation_count, h_index, tags_json, location, email)
       VALUES (@id, @name_cn, @name_en, @initials, @avatar_color, @role, @affiliation, @bio, @citations, @citation_count, @h_index, @tags_json, @location, @email)`
    );
    for (const s of scholars) {
      insertScholar.run({
        ...s,
        citation_count: parseCitationCount(s.citations),
        tags_json: jsonStringify(s.tags),
        location: s.location || null,
        email: s.email || null,
      });
    }

    // ---- 学者发表 ----
    const insertPub = db.prepare(
      `INSERT INTO scholar_publications (id, scholar_id, title, abstract, authors, venue, citations, citations_short)
       VALUES (@id, @scholar_id, @title, @abstract, @authors, @venue, @citations, @citations_short)`
    );
    for (const [sid, pubs] of Object.entries(scholarPublications)) {
      for (const pub of pubs) {
        insertPub.run({ ...pub, scholar_id: sid });
      }
    }

    // ---- 学者年引用 ----
    const insertYearly = db.prepare(
      `INSERT INTO scholar_yearly_citations (scholar_id, year, value) VALUES (?, ?, ?)`
    );
    for (const [sid, data] of Object.entries(scholarYearlyCitations)) {
      for (let i = 0; i < data.years.length; i++) {
        insertYearly.run(sid, data.years[i], data.values[i]);
      }
    }

    // ---- 机构 ----
    const insertInst = db.prepare(
      `INSERT INTO institutions (id, name_cn, name_en, initials, logo_color, type, location, intro, stats_json, fields_json, highlight, bookmarked, rank, papers_per_year)
       VALUES (@id, @name_cn, @name_en, @initials, @logo_color, @type, @location, @intro, @stats_json, @fields_json, @highlight, @bookmarked, @rank, @papers_per_year)`
    );
    for (const i of institutions) {
      insertInst.run({
        id: i.id,
        name_cn: i.name_cn ?? null,
        name_en: i.name_en ?? null,
        initials: i.initials ?? null,
        logo_color: i.logo_color ?? null,
        type: i.type ?? null,
        location: i.location ?? null,
        intro: i.intro ?? null,
        stats_json: jsonStringify(i.stats ?? []),
        fields_json: jsonStringify(i.fields ?? []),
        highlight: i.highlight ?? null,
        bookmarked: i.bookmarked ?? 0,
        rank: i.rank ?? null,
        papers_per_year: i.papers_per_year ?? null,
      });
    }

    // ---- 投稿目标 ----
    const insertVenue = db.prepare(
      `INSERT INTO venues (id, kind, abbr, full_name, badges_json, meta_rows_json, chips_json, accent, deadline_label, deadline_date, deadline_offset_ms, domain, acceptance_rate, match_pct)
       VALUES (@id, @kind, @abbr, @full_name, @badges_json, @meta_rows_json, @chips_json, @accent, @deadline_label, @deadline_date, @deadline_offset_ms, @domain, @acceptance_rate, @match_pct)`
    );
    for (const v of venues) {
      insertVenue.run({
        id: v.id,
        kind: v.kind,
        abbr: v.abbr ?? null,
        full_name: v.full_name ?? null,
        badges_json: jsonStringify(v.badges ?? []),
        meta_rows_json: jsonStringify(v.meta_rows ?? []),
        chips_json: jsonStringify(v.chips ?? []),
        accent: v.accent ?? 'success',
        deadline_label: v.deadline_label ?? null,
        deadline_date: v.deadline_date ?? null,
        deadline_offset_ms: v.deadline_offset_ms ?? 0,
        domain: v.domain ?? null,
        acceptance_rate: v.acceptance_rate ?? null,
        match_pct: v.match_pct ?? null,
      });
    }

    // ---- 知识图谱：公域 ----
    const insertNode = db.prepare(
      `INSERT INTO graph_nodes (id, graph_type, label_lines_json, weight, year, title, authors, venue, citations, abstract, paper_id, layer)
       VALUES (@id, 'public', @label_lines_json, @weight, @year, @title, @authors, @venue, @citations, @abstract, @paper_id, NULL)`
    );
    for (const n of graphNodesPublic) {
      insertNode.run({ ...n, label_lines_json: jsonStringify(n.label_lines), paper_id: n.paper_id || null });
    }
    const insertEdge = db.prepare(
      `INSERT INTO graph_edges (graph_type, source, target, strength, cross_layer) VALUES ('public', ?, ?, ?, 0)`
    );
    for (const e of graphEdgesPublic) {
      insertEdge.run(e[0], e[1], e[2]);
    }
    const insertRel = db.prepare(
      `INSERT INTO graph_related_ids (graph_type, node_id, sort_order) VALUES ('public', ?, ?)`
    );
    for (let i = 0; i < graphRelatedIdsPublic.length; i++) {
      insertRel.run(graphRelatedIdsPublic[i], i);
    }

    // ---- 知识图谱：私域 ----
    const insertNodePriv = db.prepare(
      `INSERT INTO graph_nodes (id, graph_type, label_lines_json, weight, year, title, authors, venue, citations, abstract, paper_id, layer)
       VALUES (@id, 'private', @label_lines_json, @weight, @year, @title, @authors, @venue, @citations, @abstract, @paper_id, @layer)`
    );
    for (const n of graphNodesPrivate) {
      insertNodePriv.run({ ...n, label_lines_json: jsonStringify(n.label_lines), paper_id: n.paper_id || null });
    }
    const insertEdgePriv = db.prepare(
      `INSERT INTO graph_edges (graph_type, source, target, strength, cross_layer) VALUES ('private', ?, ?, ?, ?)`
    );
    for (const e of graphEdgesPrivate) {
      insertEdgePriv.run(e[0], e[1], e[2], e[3]);
    }
    const insertRelPriv = db.prepare(
      `INSERT INTO graph_related_ids (graph_type, node_id, sort_order) VALUES ('private', ?, ?)`
    );
    for (let i = 0; i < graphRelatedIdsPrivate.length; i++) {
      insertRelPriv.run(graphRelatedIdsPrivate[i], i);
    }

    // ---- 默认用户的知识库文件夹 ----
    const insertFolder = db.prepare(
      `INSERT INTO library_folders (user_id, name, count, active) VALUES (?, ?, ?, ?)`
    );
    for (const f of defaultLibraryFolders) {
      insertFolder.run("user_demo", f.name, f.count, (f as any).active || 0);
    }

    // ---- 默认用户的知识库文献 ----
    const insertLib = db.prepare(
      `INSERT INTO library_items (id, user_id, title, venue, arxiv, authors, pdf_tone, folder, tags_json)
       VALUES (@id, 'user_demo', @title, @venue, @arxiv, @authors, @pdf_tone, @folder, '[]')`
    );
    for (const l of defaultLibraryItems) {
      insertLib.run(l);
    }

    // ---- 默认用户的通知 ----
    const insertNotif = db.prepare(
      `INSERT INTO notifications (id, user_id, type, title, desc, time, read, icon)
       VALUES (@id, 'user_demo', @type, @title, @desc, @time, 0, @icon)`
    );
    for (const n of defaultNotifications) {
      insertNotif.run(n);
    }

    // ---- 默认用户的项目 ----
    const projectId = "scinexus";
    const milestones = [
      { title: "原型页面转换", detail: "7 张 SVG 原型 + 2 个知识图谱页，9 个路由全部完成", status: "done", order: 0 },
      { title: "品牌体系落地", detail: "书法 Logo 日/夜双版 + 「深识」配色令牌，日夜间模式", status: "done", order: 1 },
      { title: "部署上线", detail: "阿里云 ECS + GitHub Actions CI/CD，push 即发布", status: "done", order: 2 },
      { title: "设置与用户体系界面", detail: "设置页七 Tab、登录弹窗、个人学者画像(演示态)", status: "doing", order: 3 },
      { title: "接入真实数据层", detail: "Server Actions + 数据库替换 mock；认证(NextAuth)", status: "todo", order: 4 },
      { title: "编辑器与可视化", detail: "TipTap 文档编辑、D3.js 图谱交互增强", status: "todo", order: 5 },
    ];
    db.prepare(
      `INSERT INTO projects (id, user_id, name, tagline, status, progress, created_at, owner, overview_json, tech_stack_json, members_json, links_json)
       VALUES (?, 'user_demo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      projectId,
      "研枢",
      "SciNexus —— 面向 AI 领域的个性化自主科研知识智能体平台",
      "进行中",
      68,
      "2025-11-02",
      "Hakrin-dev",
      jsonStringify([
        "研枢提供论文检索、投稿筛选与 AI 深度搜索服务。",
        "基于 Next.js 16 + React 19 构建，支持 Docker 容器化部署与 GitHub Actions CI/CD。",
      ]),
      jsonStringify(["Next.js 16", "React 19", "TypeScript", "Tailwind CSS 4", "TanStack Query", "Zustand", "Framer Motion", "Docker"]),
      jsonStringify([
        { name: "Hakrin-dev", role: "负责人" },
        { name: "陈研", role: "前端" },
        { name: "李识", role: "算法" },
      ]),
      jsonStringify([
        { label: "GitHub 仓库", href: "https://github.com/Hakrin-dev/SciNexus-substitute" },
        { label: "GHCR 镜像", href: "https://ghcr.io/Hakrin-dev/SciNexus-substitute" },
      ])
    );
    const insertMs = db.prepare(
      `INSERT INTO project_milestones (project_id, title, detail, status, sort_order) VALUES (?, ?, ?, ?, ?)`
    );
    for (const m of milestones) {
      insertMs.run(projectId, m.title, m.detail, m.status, m.order);
    }

    console.log("[seed] 种子数据写入完成 ✅");
  });
  tx();
}
