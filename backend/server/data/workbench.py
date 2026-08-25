"""课题工作台领域数据 —— 迁移自前端 lib/data/workbench.ts(TS 类型即前后端契约)。

样例沿用「研枢」项目,任意项目 id 复用同一套骨架。仅提供读取,写操作由后续真实库接入。
"""

WORKBENCH_OUTLINE = [
    {
        "id": "q1",
        "kind": "question",
        "title": "多智能体综述管线如何保证引用真实性与论断不丢失?",
        "status": "open",
        "detail": "核心研究问题:论断提取→聚类→成文三阶段管线的正确性边界。",
        "aiNote": "近 30 天新增 5 篇相关文献,建议优先核对聚类不变式相关章节。",
        "assetRefs": ["a1", "a2", "a3"],
        "children": [
            {
                "id": "h1",
                "kind": "hypothesis",
                "title": "全分划聚类可避免论断静默丢失",
                "status": "supported",
                "detail": "漏归论文补聚后,分划不变式在全部测试集成立。",
                "aiNote": "与 a2 实验数据匹配度 85%。",
                "assetRefs": ["a2"],
                "children": [
                    {
                        "id": "e1",
                        "kind": "evidence",
                        "title": "论断提取结构化输出实验(NeurIPS 语料)",
                        "status": "supported",
                        "assetRefs": ["a1"],
                        "children": [],
                    },
                    {
                        "id": "e2",
                        "kind": "evidence",
                        "title": "聚类漏归补聚回归实验",
                        "status": "supported",
                        "assetRefs": ["a2"],
                        "children": [],
                    },
                ],
            },
            {
                "id": "h2",
                "kind": "hypothesis",
                "title": "引用校验重生成可将幽灵引用降为 0",
                "status": "contested",
                "detail": "resolve_citations 重编号在长文档场景仍有 1 例悬空引用。",
                "aiNote": "断点:H2 缺少跨领域数据集验证,建议补充。",
                "assetRefs": ["a3", "a5"],
                "children": [
                    {
                        "id": "e3",
                        "kind": "evidence",
                        "title": "引用重编号单测(零悬空引用)",
                        "status": "supported",
                        "assetRefs": ["a3"],
                        "children": [],
                    },
                    {
                        "id": "e4",
                        "kind": "evidence",
                        "title": "幽灵引用回归实验(进行中)",
                        "status": "open",
                        "assetRefs": ["a5"],
                        "children": [],
                    },
                ],
            },
            {
                "id": "c1",
                "kind": "conclusion",
                "title": "管线在受限域内引用真实性可保证",
                "status": "done",
                "assetRefs": [],
                "children": [],
            },
        ],
    },
    {
        "id": "q2",
        "kind": "question",
        "title": "critic 反馈能否定向提升 writer 初稿质量?",
        "status": "open",
        "detail": "writer→critic→writer 回环的收益评估。",
        "assetRefs": ["a4"],
        "children": [
            {
                "id": "h3",
                "kind": "hypothesis",
                "title": "定向修订优于全量重跑(成本/质量比)",
                "status": "contested",
                "assetRefs": ["a4"],
                "children": [],
            },
        ],
    },
    {
        "id": "n1",
        "kind": "note",
        "title": "方法论笔记:结构化输出 schema 设计原则",
        "status": "open",
        "assetRefs": ["a3"],
        "children": [],
    },
]

WORKBENCH_THREADS = [
    {
        "id": "t1",
        "questionId": "q1",
        "title": "多智能体综述管线如何保证引用真实性与论断不丢失?",
        "stage": "数据分析",
    },
]

WORKBENCH_CARDS = [
    {"id": "card1", "threadId": "t1", "kind": "question", "title": "提出研究问题 Q1", "summary": "从综述生成任务出发,定义「引用真实性」与「论断不丢失」两个正确性指标。", "status": "done", "assetRefs": [], "nodeRef": "q1", "createdAt": "2026-08-02T10:00:00+08:00"},
    {"id": "card2", "threadId": "t1", "kind": "literature", "title": "scout 检索:28 篇相关文献入库", "summary": "混合召回 + 精排,其中 5 篇与聚类不变式直接相关,已挂到证据节点。", "status": "done", "assetRefs": ["a1", "a4"], "nodeRef": "e1", "aiGenerated": True, "createdAt": "2026-08-06T10:00:00+08:00"},
    {"id": "card3", "threadId": "t1", "kind": "hypothesis", "title": "假设 H1:全分划聚类避免静默丢失", "summary": "若每条论断必属且仅属一个维度,则补聚后可实现零丢失。", "status": "done", "assetRefs": ["a2"], "nodeRef": "h1", "createdAt": "2026-08-09T10:00:00+08:00"},
    {"id": "card9", "threadId": "t1", "kind": "hint", "title": "AI 断点提示", "summary": "H2「幽灵引用降为 0」缺少跨领域数据集验证,当前证据仅覆盖 AI 领域语料。", "status": "todo", "assetRefs": ["a5"], "nodeRef": "h2", "aiGenerated": True, "createdAt": "2026-08-20T10:00:00+08:00"},
    {"id": "card4", "threadId": "t1", "kind": "experiment", "title": "实验设计:聚类漏归补聚回归", "summary": "对漏归论文执行二次聚类,校验分划不变式;数据集 a2。", "status": "doing", "assetRefs": ["a2"], "nodeRef": "e2", "createdAt": "2026-08-12T10:00:00+08:00"},
    {"id": "card5", "threadId": "t1", "kind": "result", "title": "代码运行完成:12/13 用例通过", "summary": "长文档场景出现 1 例悬空引用,已回写 H2 为存疑。", "status": "doing", "assetRefs": ["a5"], "nodeRef": "e4", "aiGenerated": True, "createdAt": "2026-08-21T10:00:00+08:00"},
    {"id": "card6", "threadId": "t1", "kind": "analysis", "title": "分析笔记:失败用例归因", "summary": "悬空引用源于跨章节引用编号漂移,拟引入全局编号池。", "status": "done", "assetRefs": ["a3"], "aiGenerated": True, "createdAt": "2026-08-22T10:00:00+08:00"},
    {"id": "card7", "threadId": "t1", "kind": "conclusion", "title": "阶段结论 C1", "summary": "受限域内管线引用真实性可保证;跨域场景待 e4 实验收敛后更新。", "status": "todo", "assetRefs": [], "nodeRef": "c1", "createdAt": "2026-08-23T10:00:00+08:00"},
    {"id": "card8", "threadId": "t1", "kind": "next", "title": "下一步:补充跨领域验证集", "summary": "从 OpenAlex 拉取生物医学语料 200 篇,复跑幽灵引用回归。", "status": "todo", "assetRefs": ["a5"], "createdAt": "2026-08-23T18:00:00+08:00"},
]

WORKBENCH_ASSETS = [
    {"id": "a1", "kind": "paper", "title": "Structured Claim Extraction for Literature Review Pipelines", "meta": "NeurIPS · 2026", "questionIds": ["q1"], "hypothesisIds": ["h1"], "status": "analyzed", "tags": ["综述", "结构化输出"], "updatedAt": "2026-08-06T10:00:00+08:00"},
    {"id": "a2", "kind": "dataset", "title": "论断聚类实验数据 v2(含漏归标注)", "meta": "JSON · 48 MB", "questionIds": ["q1"], "hypothesisIds": ["h1"], "status": "active", "tags": ["聚类", "回归实验"], "updatedAt": "2026-08-12T10:00:00+08:00"},
    {"id": "a3", "kind": "note", "title": "引用重编号规则笔记(resolve_citations)", "meta": "Markdown", "questionIds": ["q1"], "hypothesisIds": ["h2"], "status": "analyzed", "tags": ["引用对齐"], "updatedAt": "2026-08-22T10:00:00+08:00"},
    {"id": "a4", "kind": "paper", "title": "Iterative Review Refinement with Critic Feedback", "meta": "ICLR · 2026", "questionIds": ["q2"], "hypothesisIds": ["h3"], "status": "unread", "tags": ["修订策略"], "updatedAt": "2026-08-19T10:00:00+08:00"},
    {"id": "a5", "kind": "experiment", "title": "幽灵引用回归实验(脚本 + 输出)", "meta": "Python · 运行中", "questionIds": ["q1"], "hypothesisIds": ["h2"], "status": "active", "tags": ["引用对齐", "回归实验"], "updatedAt": "2026-08-21T10:00:00+08:00"},
    {"id": "a6", "kind": "dataset", "title": "早期用户反馈数据(已归档)", "meta": "CSV · 2 MB", "questionIds": [], "hypothesisIds": [], "status": "archived", "tags": ["用户研究"], "updatedAt": "2026-08-03T10:00:00+08:00"},
]

WORKBENCH_ACTIVITY = [
    {"id": "log1", "at": "2026-08-23T18:00:00+08:00", "actor": "agent", "type": "summary", "text": "今日摘要:阅读 2 篇文献,推进 1 个实验,产出分析笔记 1 条。", "threadId": "t1"},
    {"id": "log2", "at": "2026-08-23T17:00:00+08:00", "actor": "system", "type": "task", "text": "AI 提取了 3 条新证据并关联到假设 H1。"},
    {"id": "log3", "at": "2026-08-23T15:00:00+08:00", "actor": "user", "type": "note", "text": "手动备注:全局编号池方案需要先评审再实施。", "threadId": "t1"},
    {"id": "log4", "at": "2026-08-22T16:00:00+08:00", "actor": "agent", "type": "task", "text": "writer 生成了 C1 阶段结论草稿,等待确认。", "threadId": "t1"},
    {"id": "log5", "at": "2026-08-22T11:00:00+08:00", "actor": "user", "type": "data", "text": "上传实验输出 a5(12/13 用例通过)。"},
    {"id": "log6", "at": "2026-08-21T10:00:00+08:00", "actor": "agent", "type": "task", "text": "code_assistant 触发幽灵引用回归实验,预计 40 分钟。", "threadId": "t1"},
    {"id": "log7", "at": "2026-08-20T14:00:00+08:00", "actor": "agent", "type": "summary", "text": "critic 检测到逻辑断点:H2 缺乏跨领域数据支持,已插入提示卡。", "threadId": "t1"},
    {"id": "log8", "at": "2026-08-19T09:00:00+08:00", "actor": "user", "type": "literature", "text": "导入文献 a4 至资产库,待阅读。"},
]

WORKBENCH_OVERVIEW = {
    "focus": {
        "questionId": "q1",
        "question": "多智能体综述管线如何保证引用真实性与论断不丢失?",
        "recentDocs": ["引用重编号规则笔记", "Critic Feedback(ICLR 2026)"],
        "runningExperiments": ["幽灵引用回归实验(12/13 用例)"],
    },
    "blockers": [
        {"id": "b1", "text": "H2 缺少跨领域数据集验证(e4 未收敛)", "view": "outline"},
        {"id": "b2", "text": "文献 a4「Critic Feedback」待阅读,可能影响 q2 方案", "view": "assets"},
    ],
    "suggestions": [
        {"id": "s1", "text": "阅读 a4 并评估其定向修订策略与 writer 回环的差异", "view": "assets"},
        {"id": "s2", "text": "从 OpenAlex 补充生物医学语料,扩展幽灵引用回归覆盖面", "view": "thread"},
        {"id": "s3", "text": "确认 C1 结论措辞后关闭线程 t1 的结论卡", "view": "thread"},
    ],
}

WORKBENCH_AGENT_TASKS = [
    {"id": "task1", "agent": "scout", "label": "正在下载补充材料(生物医学语料)", "state": "running"},
    {"id": "task2", "agent": "code_assistant", "label": "代码运行中:幽灵引用回归", "state": "running"},
    {"id": "task3", "agent": "librarian", "label": "构建证据图谱(q1)", "state": "queued"},
    {"id": "task4", "agent": "writer", "label": "C1 结论草稿已生成", "state": "done"},
]
