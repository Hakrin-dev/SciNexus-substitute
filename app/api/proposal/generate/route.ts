/**
 * POST /api/proposal/generate
 * 生成开题报告 / 文献综述初稿（演示用静态内容 + 动态变量填充）
 *
 * Body: {
 *   type: 'proposal' | 'review',
 *   topic?: string,       // 主题（可选，默认基于项目检索）
 *   papers_count?: number // 参考论文数
 * }
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";

export const runtime = "nodejs";

interface Req {
  type: "proposal" | "review";
  topic?: string;
  papers_count?: number;
}

export async function POST(req: NextRequest) {
  ensureSeed();
  try {
    const body = await parseBody<Req>(req);
    const type = body.type || "review";
    const topic = body.topic?.trim() || "扩散模型在机器人策略学习中的研究进展";
    const count = body.papers_count || 28;

    const content =
      type === "proposal"
        ? `# 开题报告:${topic}\n\n## 一、研究背景与意义\n大语言模型驱动的科研智能体正在改变文献调研、假设生成与实验设计的工作方式。然而现有系统普遍存在检索碎片化、知识组织缺乏结构、长程任务规划能力弱三个问题，难以支撑完整的科研工作流。\n\n## 二、国内外研究现状\n1. 检索增强生成(RAG)已广泛应用于问答系统；\n2. 多智能体协作框架(如 AutoGen、MetaGPT)在软件工程任务上验证有效；\n3. 私域知识图谱与向量检索的混合索引是当前知识组织的主流方向。\n\n## 三、研究内容\n1. 科研任务的多智能体角色建模与任务分解机制；\n2. 基于私域知识图谱的文献知识组织与检索增强方法；\n3. 长程科研任务的规划-执行-反思闭环架构；\n4. 原型系统实现与评估。\n\n## 四、技术路线\n文献调研 → 架构设计 → 关键模块实现 → 系统集成 → 对比实验 → 论文撰写。\n\n## 五、预期成果\n1. 发表 CCF-A 类会议论文 1~2 篇；\n2. 开源原型系统一套；\n3. 构建面向文献调研任务的评测基准一个。\n\n(演示初稿,基于项目检索的 ${count} 篇文献生成,请在导师指导下修改完善)`
        : `# 文献综述:${topic}\n\n## 1. 引言\n相关技术自引入其所在领域后,近年被广泛推广应用。本综述基于 ${count} 篇代表性文献,梳理该方向的发展脉络、核心方法与开放问题。\n\n## 2. 发展脉络\n### 2.1 范式确立\n早期奠基性工作提出了核心思想,为后续研究奠定了基础,在多个公开基准上取得了显著提升。\n\n### 2.2 表征扩展\n后续工作通过引入多模态信息与场景约束,把方法扩展到更复杂的任务设定,显著降低了对数据量的需求。\n\n### 2.3 规模化与通用化\n近期工作将模型规模推至十亿参数并验证跨领域迁移能力,并探索状态空间模型等加速方向。\n\n## 3. 关键技术分析\n- **核心模块设计**:在表达能力与计算效率间取得平衡,是核心超参;\n- **条件注入机制**:FiLM 调制相比特征拼接在长序列训练中更稳定;\n- **推理效率**:采样步数是工业部署的主要瓶颈,加速方法是当前热点。\n\n## 4. 开放问题\n1. 实时性:高频场景下的延迟压缩;\n2. 安全性:生成随机性与确定性的矛盾;\n3. 数据效率:跨领域数据的统一表征与质量筛选。\n\n## 5. 小结\n该方向已从学术原型进入工业验证阶段,与基础模型的融合是下一步最值得关注的方向。\n\n(演示初稿,请核对引用后使用)`;

    return ok({
      type,
      topic,
      content,
      papers_count: count,
      generated_at: new Date().toISOString(),
    });
  } catch (e: any) {
    return fail(e.message || "生成失败");
  }
}
