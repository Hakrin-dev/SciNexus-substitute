/** 文献精读 —— AI 解析结果(演示数据,模拟 PDF 上传后的解析产出) */
export const readerPaper = {
  fileName: "diffusion-policy-corl2024.pdf",
  title: "Diffusion Policy: Visuomotor Policy Learning via Action Diffusion",
  titleZh: "扩散策略:基于动作扩散的视觉运动策略学习",
  meta: "CoRL 2024 · Chi et al. · Stanford",
  parseMeta: "AI 解析完成 · 全文翻译 · 2 张图表 · 3 条批注",
  summary:
    "本文将去噪扩散概率模型(DDPM)引入机器人动作空间预测,提出扩散策略(Diffusion Policy):以视觉观测为条件,迭代去噪生成整段动作序列。在 12 个任务上平均成功率比此前最优方法提升 46.9%,关键在于动作分块与时序一致性约束显著降低了长程操控中的累积误差。",
};

/** 对照翻译段落 */
export const readerSections: {
  id: string;
  heading: string;
  headingZh: string;
  paragraphs: { id: string; en: string; zh: string }[];
}[] = [
  {
    id: "intro",
    heading: "1. Introduction",
    headingZh: "1. 引言",
    paragraphs: [
      {
        id: "p1",
        en: "Learning visuomotor policies from demonstrations remains a central challenge in robotics. While behavior cloning offers a simple supervised approach, it struggles with multimodal action distributions and compounding errors over long horizons.",
        zh: "从示范中学习视觉运动策略仍是机器人学的核心难题。行为克隆虽然是一种简单的监督方法,但难以处理多模态动作分布,且长程任务中的累积误差问题突出。",
      },
      {
        id: "p2",
        en: "We propose Diffusion Policy, which formulates policy learning as a conditional denoising diffusion process over action sequences. Instead of regressing actions directly, the policy iteratively refines a noisy action trajectory, conditioned on visual observations.",
        zh: "本文提出扩散策略(Diffusion Policy),将策略学习建模为动作序列上的条件去噪扩散过程。策略不再直接回归动作,而是以视觉观测为条件,对含噪动作轨迹进行迭代细化。",
      },
    ],
  },
  {
    id: "method",
    heading: "3. Method",
    headingZh: "3. 方法",
    paragraphs: [
      {
        id: "p3",
        en: "The key design choice is action chunking: the policy predicts a fixed-length sequence of future actions, but executes only the first few steps before replanning. This receding-horizon scheme balances temporal consistency against reactivity.",
        zh: "关键设计是动作分块(Action Chunking):策略预测固定长度的未来动作序列,但只执行前几步便重新规划。这种滚动时域方案在时序一致性与反应速度之间取得平衡。",
      },
    ],
  },
];

/** 图表与 AI 解释 */
export const readerFigures: {
  id: string;
  caption: string;
  captionZh: string;
  explanation: string;
}[] = [
  {
    id: "fig2",
    caption: "Figure 2: Architecture of Diffusion Policy",
    captionZh: "图 2:扩散策略的网络架构",
    explanation:
      "AI 解读:图中左侧为视觉编码器(ResNet-18)提取观测特征;中间的去噪网络以特征为条件,对随机初始化的动作序列做 K 步去噪;右侧输出未来 16 步动作块。注意条件注入采用 FiLM 调制而非拼接,这是长序列稳定训练的关键。",
  },
  {
    id: "fig4",
    caption: "Figure 4: Success rate comparison on 12 tasks",
    captionZh: "图 4:12 个任务上的成功率对比",
    explanation:
      "AI 解读:柱状图显示扩散策略(橙色)在 12 个任务中的 9 个上超过 IBC 与 BET 基线,提升最大的是需要精细力控的 Push-T 与 Insertion 任务;在简单的 Reacher 任务上三者持平,说明扩散模型的优势主要在多模态、长程场景。",
  },
];

/** 初始批注(演示) */
export const readerAnnotations: {
  id: string;
  quote: string;
  note: string;
  createdAt: string;
}[] = [
  {
    id: "a1",
    quote: "iteratively refines a noisy action trajectory",
    note: "与图像扩散的对应关系:动作序列 ≈ 像素,去噪步数 K 是推理延迟的主因,可参考 DDIM 加速。",
    createdAt: "昨天 21:14",
  },
  {
    id: "a2",
    quote: "executes only the first few steps before replanning",
    note: "开环步数 h 是超参:论文取 8/16。做机械臂实验时先从 h=4 试起。",
    createdAt: "今天 09:32",
  },
];
