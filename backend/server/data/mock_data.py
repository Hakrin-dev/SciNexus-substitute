"""
研枢平台 - 模拟数据层
所有 Mock 数据集中管理，模拟后端数据库行为
"""
import random
from datetime import datetime, timedelta

# ==================== 论文库 ====================
PAPERS = [
    {"id":"p1","title":"Attention Is All You Need","authors":"Vaswani et al.","venue":"NeurIPS 2017","ccf":"A","match":"perfect","matchLabel":"Perfect","abstract":"提出Transformer架构，完全基于注意力机制替代循环和卷积。该模型在WMT 2014英德翻译上达到28.4 BLEU，训练速度是现有模型的数倍。","citations":"98,700+","heat":"Hot","year":2017,"keywords":["attention","transformer","machine-translation"],"doi":"10.5555/3295222.3295349","trend":"up"},
    {"id":"p2","title":"BERT: Pre-training of Deep Bidirectional Transformers","authors":"Devlin et al.","venue":"NAACL 2019","ccf":"A","match":"perfect","matchLabel":"Perfect","abstract":"提出BERT模型，通过掩码语言模型和下一句预测进行深度双向预训练。在11项NLP任务上取得最先进结果，GLUE基准提升7.7%。","citations":"65,200+","heat":"Hot","year":2019,"keywords":["bert","pre-training","nlp"],"doi":"10.18653/v1/N19-1423","trend":"up"},
    {"id":"p3","title":"Language Models are Few-Shot Learners","authors":"Brown et al.","venue":"NeurIPS 2020","ccf":"A","match":"perfect","matchLabel":"Perfect","abstract":"GPT-3展示了大规模语言模型在少样本学习上的惊人能力，1750亿参数，在多种NLP任务上无需微调即可达到竞争力结果。","citations":"42,500+","heat":"Hot","year":2020,"keywords":["gpt-3","few-shot","language-model"],"doi":"10.5555/3495724.3495883","trend":"up"},
    {"id":"p4","title":"Efficient Transformers: A Survey","authors":"Tay et al.","venue":"ACM Computing Surveys 2022","ccf":"B","match":"partial","matchLabel":"Partial","abstract":"综述高效Transformer变体，分类梳理了47种改进方法，包括稀疏注意力、低秩近似、记忆压缩等方向，为模型效率优化提供系统参考。","citations":"2,300+","heat":"Warm","year":2022,"keywords":["efficient-transformers","survey","attention"],"doi":"10.1145/123456","trend":"stable"},
    {"id":"p5","title":"Graph Neural Networks for Drug Discovery","authors":"Gilmer et al.","venue":"ICML 2017","ccf":"A","match":"perfect","matchLabel":"Perfect","abstract":"提出消息传递神经网络框架用于分子性质预测，将图神经网络应用于量子化学计算，在QM9数据集上显著优于传统方法。","citations":"8,900+","heat":"Warm","year":2017,"keywords":["gnn","drug-discovery","cheminformatics"],"doi":"10.5555/3305381.3305512","trend":"up"},
    {"id":"p6","title":"Contrastive Learning in Vision: A Comprehensive Review","authors":"Chen et al.","venue":"IJCV 2021","ccf":"A","match":"partial","matchLabel":"Partial","abstract":"综述对比学习在计算机视觉中的应用，涵盖SimCLR、MoCo、BYOL等代表性方法，分析不同对比学习框架的理论联系和实验性能。","citations":"5,600+","heat":"Warm","year":2021,"keywords":["contrastive-learning","computer-vision","self-supervised"],"doi":"10.1007/s11263-021-01458","trend":"stable"},
    {"id":"p7","title":"RLHF: From Core Technical to Alignment","authors":"Ouyang et al.","venue":"NeurIPS 2022","ccf":"A","match":"perfect","matchLabel":"Perfect","abstract":"基于人类反馈的强化学习技术在InstructGPT中的应用，展示了RLHF如何使语言模型更好地遵循用户指令并减少有害输出。","citations":"3,200+","heat":"Warm","year":2022,"keywords":["rlhf","alignment","instruct-gpt"],"doi":"10.5555/3456789","trend":"up"},
    {"id":"p8","title":"Multi-modal Medical Image Fusion","authors":"Zhang et al.","venue":"Medical Image Analysis 2023","ccf":"B","match":"partial","matchLabel":"Partial","abstract":"提出新的多模态医学图像融合框架，结合Transformer和CNN提取互补特征，在CT-MRI和PET-MRI融合任务上取得最优结果。","citations":"890+","heat":"Warm","year":2023,"keywords":["medical-image","multimodal","fusion"],"doi":"10.1016/j.media.2023.102812","trend":"up"},
    {"id":"p9","title":"Federated Learning at the Edge: A Survey","authors":"Lim et al.","venue":"IEEE COMST 2020","ccf":"C","match":"weak","matchLabel":"Weak","abstract":"全面综述边缘计算中的联邦学习方法，涵盖通信效率、隐私保护、异构性和激励机制等核心挑战。","citations":"1,800+","heat":"Warm","year":2020,"keywords":["federated-learning","edge-computing","survey"],"doi":"10.1109/COMST.2020.2986024","trend":"down"},
    {"id":"p10","title":"Deep Learning for Protein Structure Prediction","authors":"Jumper et al.","venue":"Nature 2021","ccf":"A","match":"perfect","matchLabel":"Perfect","abstract":"AlphaFold2利用深度学习突破蛋白质结构预测难题，在CASP14上达到原子级精度，被视为计算生物学里程碑。","citations":"21,000+","heat":"Hot","year":2021,"keywords":["alphafold","protein-structure","deep-learning"],"doi":"10.1038/s41586-021-03819-2","trend":"up"},
    {"id":"p11","title":"Swin Transformer: Hierarchical Vision Transformer","authors":"Liu et al.","venue":"ICCV 2021","ccf":"A","match":"perfect","matchLabel":"Perfect","abstract":"Swin Transformer通过移位窗口机制构建层次化Transformer，在图像分类、目标检测和语义分割上全面超越CNN基线。","citations":"18,500+","heat":"Hot","year":2021,"keywords":["swin-transformer","vision","hierarchical"],"doi":"10.1109/ICCV48922.2021.00986","trend":"up"},
]

# ==================== 期刊/会议库 ====================
JOURNALS = [
    {"id":"j1","name":"CVPR","ccf":"A","fullName":"IEEE Conference on Computer Vision and Pattern Recognition","deadline":"2024-11-15","urgent":False,"rate":25.2,"matchPct":92,"matchClass":"high","submissions":3420,"domain":"计算机视觉","location":"西雅图, 美国"},
    {"id":"j2","name":"ACL","ccf":"A","fullName":"Annual Meeting of the Association for Computational Linguistics","deadline":"2025-02-15","urgent":False,"rate":23.8,"matchPct":88,"matchClass":"high","submissions":2860,"domain":"自然语言处理","location":"维也纳, 奥地利"},
    {"id":"j3","name":"EMNLP","ccf":"B","fullName":"Conference on Empirical Methods in Natural Language Processing","deadline":"2024-12-05","urgent":True,"rate":22.1,"matchPct":76,"matchClass":"mid","submissions":2150,"domain":"自然语言处理","location":"新加坡"},
    {"id":"j4","name":"ICCV","ccf":"A","fullName":"International Conference on Computer Vision","deadline":"2025-03-10","urgent":False,"rate":30.5,"matchPct":65,"matchClass":"low","submissions":3850,"domain":"计算机视觉","location":"檀香山, 美国"},
    {"id":"j5","name":"NeurIPS","ccf":"A","fullName":"Conference on Neural Information Processing Systems","deadline":"2025-05-20","urgent":False,"rate":21.4,"matchPct":85,"matchClass":"high","submissions":12300,"domain":"机器学习","location":"温哥华, 加拿大"},
    {"id":"j6","name":"ICML","ccf":"A","fullName":"International Conference on Machine Learning","deadline":"2025-01-15","urgent":False,"rate":20.3,"matchPct":80,"matchClass":"high","submissions":9800,"domain":"机器学习","location":"慕尼黑, 德国"},
    {"id":"j7","name":"AAAI","ccf":"A","fullName":"AAAI Conference on Artificial Intelligence","deadline":"2024-08-15","urgent":True,"rate":19.8,"matchPct":73,"matchClass":"mid","submissions":8700,"domain":"人工智能","location":"费城, 美国"},
    {"id":"j8","name":"IJCAI","ccf":"A","fullName":"International Joint Conference on Artificial Intelligence","deadline":"2025-01-15","urgent":False,"rate":15.2,"matchPct":68,"matchClass":"mid","submissions":6500,"domain":"人工智能","location":"蒙特利尔, 加拿大"},
]

# ==================== AI 对话模拟 ====================
CONVERSATIONS = [
    {
        "id":"c1","title":"Transformer综述撰写",
        "preview":"帮我写一篇关于Transformer的文献综述...",
        "messages":[
            {"type":"user","text":"帮我写一篇关于Transformer的文献综述"},
            {"type":"ai","text":"好的！我将为您撰写一篇关于Transformer架构的文献综述。以下是内容大纲：\n\n**综述大纲**\n1. 引言 - Transformer的背景与动机\n2. 核心机制 - 多头注意力、位置编码、FFN\n3. 代表性模型 - BERT、GPT系列、T5、ViT\n4. 2023年后改进工作 - FlashAttention、Mamba、Hyena等\n5. 方法对比表格 - 各模型在典型任务上的表现\n6. 未来展望与挑战\n\n我现在开始在右侧编辑区生成完整综述，请查看。"},
            {"type":"user","text":"重点分析2023年之后的改进工作"},
            {"type":"ai","text":"已补充2023年之后的改进工作内容。近年来Transformer的改进主要集中在以下几个方面：\n\n**1. 高效注意力机制**\n- FlashAttention (Dao et al., 2022)：通过IO感知的精确注意力算法，显著减少显存占用，训练速度提升2-4倍\n- Ring Attention (Liu et al., 2023)：支持超长序列的分布式注意力计算\n\n**2. 替代架构探索**\n- Mamba (Gu & Dao, 2023)：基于状态空间模型的线性复杂度架构\n- Hyena Hierarchy (Poli et al., 2023)：使用隐式卷积替代注意力\n\n**3. 量化与压缩**\n- SmoothQuant (Xiao et al., 2023)：8-bit量化几乎无损\n- AWQ (Lin et al., 2024)：激活感知的权重量化\n\n这些改进已在右侧编辑区更新，请查看。"},
            {"type":"user","text":"帮我补充对比表格"},
            {"type":"ai","text":"已为您生成方法对比表格：\n\n| 模型/方法 | 复杂度 | 长序列能力 | 推理速度 | 代表任务 |\n|-----------|--------|-----------|---------|--------|\n| Transformer | O(N²d) | 弱(512) | 中等 | 翻译/分类 |\n| FlashAttention | O(N²d) IO优化 | 强(16K) | 快 | 通用 |\n| Mamba | O(Nd²) 线性 | 强(1M+) | 快 | 长序列 |\n| Hyena | O(N log N) | 强(64K) | 快 | 分类/生成 |\n| Ring Attention | O(N²d/G) | 极强(1M+) | 中等 | 超长文档 |\n\n该对比表格已同步更新到右侧编辑区。"},
            {"type":"user","text":"导出为Word文档"},
            {"type":"ai","text":"已为您生成完整的综述文档。正在准备Word文档导出...\n\n文档包含：\n- 摘要与引言\n- Transformer核心技术原理\n- 2023年后关键改进详细分析\n- 模型方法对比表格\n- 参考文献（15篇）\n\n文档格式已完成，导出路径：./output/Transformer综述_2024.docx"}
        ]
    },
    {
        "id":"c2","title":"论文润色修改",
        "preview":"请帮我润色这段Introduction...",
        "messages":[
            {"type":"ai","text":"请将您需要润色的论文段落粘贴到输入框，我会从语法、流畅度和学术风格三个方面进行优化。"},
            {"type":"user","text":"In recent years, deep learning has been widely used in many areas. It achieved good results."},
            {"type":"ai","text":"已为您优化为更学术的表达：\n\n**修改后**：In recent years, deep learning has witnessed widespread adoption across diverse domains, demonstrating remarkable performance in a variety of challenging tasks.\n\n**修改说明**：改进了句式结构，使用更精准的学术词汇（witnessed widespread adoption, demonstrating remarkable performance），增强了句式复杂度。"}
        ]
    },
    {
        "id":"c3","title":"实验对比分析",
        "preview":"对比分析BERT和GPT在NLU任务上的表现...",
        "messages":[
            {"type":"ai","text":"BERT和GPT代表了两种不同的预训练范式：BERT使用编码器架构+双向注意力，擅长理解类任务；GPT使用解码器架构+自回归生成，擅长文本生成。"},
            {"type":"user","text":"在GLUE基准上，BERT和GPT的表现如何？我需要具体数据。"},
            {"type":"ai","text":"GLUE基准对比数据如下：\n\n| 任务 | BERT-Base | GPT-1 | GPT-2 | GPT-3(Zero-Shot) |\n|------|-----------|-------|-------|-------------------|\n| MNLI | 84.6 | 82.1 | 87.1 | 83.2 |\n| QQP | 88.9 | 87.4 | 90.4 | 82.1 |\n| QNLI | 90.5 | 87.4 | 91.0 | 85.2 |\n| SST-2 | 93.5 | 91.3 | 94.2 | 91.1 |\n\nBERT在理解类任务上全面领先，而GPT-3在少样本设定下的表现令人印象深刻。"}
        ]
    },
    {
        "id":"c4","title":"文献推荐讨论",
        "preview":"推荐几篇关于对比学习的最新论文...",
        "messages":[
            {"type":"user","text":"推荐几篇关于对比学习的最新论文"},
            {"type":"ai","text":"为您推荐以下5篇对比学习领域的重要论文：\n\n1. **SimCLR** (Chen et al., ICML 2020) — 简单的对比学习框架，去除记忆库需求，引用19,000+\n2. **MoCo v3** (Chen et al., ICCV 2021) — 动量对比学习的改进版，Vision Transformer骨干\n3. **BYOL** (Grill et al., NeurIPS 2020) — 无需负样本的自监督学习，引用15,000+\n4. **SimSiam** (Chen & He, CVPR 2021) — 探索简化孪生网络，无需负样本/动量编码器\n5. **CLIP** (Radford et al., ICML 2021) — 多模态对比学习，引用42,000+\n\n这些论文您可以点击\"打开阅读\"查看详情。"}
        ]
    }
]

# ==================== 用户文献库 ====================
LIBRARY_PAPERS = [
    {"id":"lp1","pid":"p1","title":"Attention Is All You Need","authors":"Vaswani et al.","venue":"NeurIPS 2017","ccf":"A","status":"read","readingProgress":100,"tags":["精读","方法论参考"],"folder":"毕业设计/参考文献","collected":"2024-09-15"},
    {"id":"lp2","pid":"p2","title":"BERT: Pre-training of Deep Bidirectional Transformers","authors":"Devlin et al.","venue":"NAACL 2019","ccf":"A","status":"read","readingProgress":100,"tags":["精读"],"folder":"毕业设计/参考文献","collected":"2024-09-18"},
    {"id":"lp3","pid":"p7","title":"RLHF: From Core Technical to Alignment","authors":"Ouyang et al.","venue":"NeurIPS 2022","ccf":"A","status":"reading","readingProgress":72,"tags":["精读","实验对比"],"folder":"综述撰写","collected":"2024-10-02"},
    {"id":"lp4","pid":"p10","title":"Deep Learning for Protein Structure Prediction","authors":"Jumper et al.","venue":"Nature 2021","ccf":"A","status":"reading","readingProgress":45,"tags":["方法论参考"],"folder":"综述撰写","collected":"2024-10-05"},
    {"id":"lp5","pid":"p5","title":"Graph Neural Networks for Drug Discovery","authors":"Gilmer et al.","venue":"ICML 2017","ccf":"A","status":"read","readingProgress":100,"tags":["实验对比"],"folder":"课程作业","collected":"2024-10-08"},
    {"id":"lp6","pid":"p11","title":"Swin Transformer: Hierarchical Vision Transformer","authors":"Liu et al.","venue":"ICCV 2021","ccf":"A","status":"read","readingProgress":100,"tags":["精读"],"folder":"毕业设计/参考文献","collected":"2024-10-10"},
    {"id":"lp7","pid":"p4","title":"Efficient Transformers: A Survey","authors":"Tay et al.","venue":"ACM Computing Surveys 2022","ccf":"B","status":"reading","readingProgress":78,"tags":["方法论参考"],"folder":"综述撰写","collected":"2024-10-12"},
    {"id":"lp8","pid":"p3","title":"Language Models are Few-Shot Learners","authors":"Brown et al.","venue":"NeurIPS 2020","ccf":"A","status":"unread","readingProgress":0,"tags":["待讨论"],"folder":"待读列表","collected":"2024-10-15"},
    {"id":"lp9","pid":"p9","title":"Federated Learning at the Edge: A Survey","authors":"Lim et al.","venue":"IEEE COMST 2020","ccf":"C","status":"unread","readingProgress":0,"tags":["待讨论"],"folder":"课程作业","collected":"2024-11-01"},
    {"id":"lp10","pid":"p6","title":"Contrastive Learning in Vision","authors":"Chen et al.","venue":"IJCV 2021","ccf":"A","status":"read","readingProgress":100,"tags":["方法论"],"folder":"毕业设计/参考文献","collected":"2024-11-05"},
    {"id":"lp11","pid":"p8","title":"Multi-modal Medical Image Fusion","authors":"Zhang et al.","venue":"Medical Image Analysis 2023","ccf":"B","status":"reading","readingProgress":45,"tags":["实验对比"],"folder":"综述撰写","collected":"2024-11-15"},
    {"id":"lp12","pid":"p1","title":"Attention Is All You Need (副本)","authors":"Vaswani et al.","venue":"NeurIPS 2017","ccf":"A","status":"unread","readingProgress":0,"tags":["精读"],"folder":"待读列表","collected":"2024-11-25"},
]

# ==================== 通知 ====================
NOTIFICATIONS = [
    {"id":"n1","type":"update","title":"文献更新提醒","desc":"您关注的「大语言模型」领域有5篇新论文发布","time":"2 分钟前","read":False,"icon":"blue"},
    {"id":"n2","type":"deadline","title":"截稿提醒","desc":"EMNLP 2025 摘要截稿倒计时：还剩12天","time":"1 小时前","read":False,"icon":"orange"},
    {"id":"n3","type":"complete","title":"AI分析完成","desc":"您的「Transformer综述」文献综述已生成完毕","time":"3 小时前","read":True,"icon":"purple"},
    {"id":"n4","type":"system","title":"系统通知","desc":"研枢平台v2.0更新：新增个人文献库和投稿分析功能","time":"昨天","read":True,"icon":"green"},
]

# ==================== 趋势图数据 ====================
TREND_DATA = {
    "years": [2020, 2021, 2022, 2023, 2024],
    "series": [
        {"name":"CVPR","data":[22.5, 23.8, 24.1, 25.0, 25.2]},
        {"name":"ACL","data":[20.1, 21.3, 22.4, 23.1, 23.8]},
        {"name":"EMNLP","data":[18.9, 19.6, 20.5, 21.5, 22.1]},
    ]
}

# ==================== 搜索历史（客户端 localStorage 管理，这里仅作缓存） ====================
SEARCH_CACHE = []

# ==================== 收藏数据 ====================
FAVORITES_CACHE = []
