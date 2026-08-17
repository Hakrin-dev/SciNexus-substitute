"""各智能体输入/输出 Schema（严格对照多智能体设计文档）。"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Status = Literal["SUCCESS", "FAILED"]


# --------------------------------------------------------------------------- #
# 1. Scout Agent（信息收集）
# --------------------------------------------------------------------------- #
class ScoutInput(BaseModel):
    user_query: str
    time_range: list[int] = Field(default_factory=list, description="[start_year, end_year]")
    venue_level: str | None = None
    core_topics: list[str] = Field(default_factory=list)
    domain: str | None = None


class ScoutFilters(BaseModel):
    core_topics: list[str] = Field(default_factory=list)
    time_range: list[int] = Field(default_factory=list)
    venue_level: str | None = None
    author: str | None = None
    domain: str | None = None


class ScoutInternals(BaseModel):
    raw_query: str
    filters: ScoutFilters
    sub_query_for_search: list[str] = Field(default_factory=list)


class RetrievedPaper(BaseModel):
    paper_id: str
    title: str
    author: str
    year: int
    institute: str | None = None
    citation_count: int = 0
    reference_ids: list[str] = Field(default_factory=list)
    match_level: Literal["PERFECT", "PARTIAL", "WEAK"]
    evidence_snippet: str
    retrieval_timestamp: str | None = None
    db_source: str | None = None
    abstract: str | None = None
    ccf: str | None = None
    heat: str | None = None
    match_label: str | None = None
    keywords: list[str] = Field(default_factory=list)
    relevance_score: float = 0.0


class ScoutOutput(BaseModel):
    status: Status
    retrieved_papers: list[RetrievedPaper] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# 2. Knowledge Synthesis（知识综合）
# --------------------------------------------------------------------------- #
class SynthesisInput(BaseModel):
    user_query: str
    paper_ids: list[str] = Field(default_factory=list)


class SynthesisInternals(BaseModel):
    raw_query: str
    target_chunks: list[str] = Field(default_factory=list)
    extraction_schema: list[str] = Field(
        default_factory=lambda: ["core_innovation", "methodology", "experimental_results", "key_challenges"]
    )


class AnchoredText(BaseModel):
    text: str
    anchor_bbox: list[int] | None = None
    chunk_id: str | None = None


class StructuredElements(BaseModel):
    summary: str
    core_innovation: AnchoredText
    methodology: str
    experimental_results: str
    key_challenges: str


class SynthesisOutput(BaseModel):
    status: Status
    structured_elements: StructuredElements
    qa_response: str


class QAAnswer(BaseModel):
    """问答专用小 schema：仅输出答案文本（由 Synthesis 单独一步生成）。"""
    answer: str


# --------------------------------------------------------------------------- #
# 3. Librarian Agent（知识管家）
# --------------------------------------------------------------------------- #
class LibrarianInput(BaseModel):
    user_query: str
    seed_paper_ids: list[str] = Field(default_factory=list, description="图谱起点")


class LibrarianInternals(BaseModel):
    graph_type: Literal["co-citation", "bibliographic_coupling"] = "co-citation"
    depth: int = 2
    user_history_interests: list[str] = Field(default_factory=list)


class GraphNode(BaseModel):
    id: str
    label: str
    category: Literal["seed", "related"]
    read_priority: int = 1


class GraphEdge(BaseModel):
    source: str
    target: str
    relation_type: Literal["cites", "same_method", "co-cited", "coupled"]


class GraphData(BaseModel):
    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)


class LibrarianOutput(BaseModel):
    status: Status
    graph_data: GraphData
    tags_recommendation: list[str] = Field(default_factory=list)
    folder_suggestion: str | None = None


# --------------------------------------------------------------------------- #
# 4. Research Design（研究设计）
# --------------------------------------------------------------------------- #
class ResearchDesignInput(BaseModel):
    user_query: str


class NoveltyAnalysis(BaseModel):
    level: Literal["high", "medium", "low"]
    comparison_with_existing_work: str
    innovation_type: list[str] = Field(default_factory=list)


class ExperimentalDesign(BaseModel):
    datasets: list[str] = Field(default_factory=list)
    baselines: list[str] = Field(default_factory=list)
    metrics: list[str] = Field(default_factory=list)


class ResearchDesignOutput(BaseModel):
    status: Status
    proposal: dict = Field(default_factory=dict, description="结构化 proposal，见设计文档")


# --------------------------------------------------------------------------- #
# 5. Code Assistant（代码辅助）
# 文档：用户输入为空，系统输入（proposal 等）来自上游 Research Design
# --------------------------------------------------------------------------- #
CodeStatus = Literal["SUCCESS", "FAILED", "PARTIAL"]


class ImplementationRequirements(BaseModel):
    language: str = "python"
    framework_version: str | None = None
    compute_environment: Literal["cpu", "gpu", "distributed"] = "gpu"
    reproducibility_level: Literal["draft", "reproducible", "publication_ready"] = "reproducible"


class CodeSpecifications(BaseModel):
    modular_structure: bool = True
    docstring_style: Literal["google", "numpy", "sphinx"] = "google"
    type_hints: bool = True
    unit_tests: bool = True
    config_management: Literal["yaml", "json", "argparse"] = "yaml"


class CodeDependencies(BaseModel):
    required_packages: list[str] = Field(default_factory=list)
    version_constraints: dict[str, str] = Field(default_factory=dict)
    cuda_compatibility: str = "none"


class CodeAssistantInput(BaseModel):
    proposal: dict = Field(default_factory=dict)
    implementation_requirements: ImplementationRequirements = Field(default_factory=ImplementationRequirements)
    code_specifications: CodeSpecifications = Field(default_factory=CodeSpecifications)
    dependencies: CodeDependencies = Field(default_factory=CodeDependencies)


class MainCode(BaseModel):
    file_path: str
    content_hash: str
    lines_of_code: int


class ConfigFile(BaseModel):
    file_path: str
    parameters_documented: bool = True


class TestSuite(BaseModel):
    file_path: str
    coverage_estimate: float
    test_cases_count: int


class GeneratedFile(BaseModel):
    path: str
    language: str = "text"
    content: str


class EnvironmentSetup(BaseModel):
    requirements_file: str
    dockerfile_available: bool
    conda_env_file: str


class GeneratedArtifacts(BaseModel):
    main_code: MainCode
    configuration_files: list[ConfigFile] = Field(default_factory=list)
    test_suite: TestSuite
    environment_setup: EnvironmentSetup


class ExecutionGuide(BaseModel):
    training_command: str
    inference_command: str
    evaluation_command: str


class ValidationReport(BaseModel):
    syntax_check: str
    import_validation: str
    api_compatibility: str
    memory_footprint_estimate: str
    estimated_training_time: str


class ErrorDetails(BaseModel):
    error_type: str
    resolution_suggestions: list[str] = Field(default_factory=list)


class CodeAssistantOutput(BaseModel):
    status: CodeStatus
    error_details: ErrorDetails | None = None
    generated_artifacts: GeneratedArtifacts
    generated_files: list[GeneratedFile] = Field(default_factory=list)
    execution_guide: ExecutionGuide
    validation_report: ValidationReport


# --------------------------------------------------------------------------- #
# 6. Writer（论文写作）
# --------------------------------------------------------------------------- #
class WriterInput(BaseModel):
    user_query: str


class ClaimEvidence(BaseModel):
    claim: str
    source_chunk_id: str


class WrittenContent(BaseModel):
    section_name: str
    latex_payload: str
    cited_paper_ids: list[str] = Field(default_factory=list)
    claim_evidence_map: list[ClaimEvidence] = Field(default_factory=list)


class WriterOutput(BaseModel):
    status: Status
    written_content: WrittenContent
    generated_files: list[GeneratedFile] = Field(default_factory=list)


class ReviewMarkdown(BaseModel):
    """文献综述正文专用小 schema：仅输出 Markdown 综述文本。"""
    markdown: str


# --------------------------------------------------------------------------- #
# 7. Critic（论文审查与决策）
# --------------------------------------------------------------------------- #
class CriticInput(BaseModel):
    user_query: str
    paper_latex: str = ""


class CriticInternals(BaseModel):
    target_venue: str | None = None
    checklist: list[str] = Field(default_factory=lambda: ["hallucination_check", "format_check", "novelty_check"])


class Issue(BaseModel):
    type: Literal["Fake Citation", "Format Error", "Logic Gap"]
    location: str
    detail: str
    action_required: str


class VenueMatch(BaseModel):
    name: str
    score: int


class VenueMatchingAnalysis(BaseModel):
    recommended_venues: list[VenueMatch] = Field(default_factory=list)
    match_reason: str


class ReviewReport(BaseModel):
    decision: Literal["ACCEPT", "REJECT_WITH_REVISION"]
    overall_score: float
    sub_scores: dict[str, int] = Field(default_factory=dict)
    issues_found: list[Issue] = Field(default_factory=list)
    venue_matching_analysis: VenueMatchingAnalysis


class CriticOutput(BaseModel):
    status: Status
    review_report: ReviewReport


# --------------------------------------------------------------------------- #
# 文献综述（综述写作，移植自 SZDR paperreport 三阶段综合 + 质量 passes）
# --------------------------------------------------------------------------- #
class ReviewClaimEntry(BaseModel):
    """单篇论文的论断提取结果。"""
    index: int = Field(description="论文在证据列表中的全局编号（1 基）")
    claims: list[str] = Field(default_factory=list)


class ReviewClaims(BaseModel):
    """阶段一输出：逐篇提取的忠实论断。"""
    papers: list[ReviewClaimEntry] = Field(default_factory=list)


class ReviewDimension(BaseModel):
    """一个研究维度（综述的一节）。"""
    name: str
    format: str = Field(default="", description="一句话说明该维度的讨论角度")
    paper_indices: list[int] = Field(default_factory=list, description="归入该维度的论文全局编号")


class ReviewCluster(BaseModel):
    """阶段二输出：论断聚类得到的研究维度。"""
    dimensions: list[ReviewDimension] = Field(default_factory=list)


class ReviewAssignment(BaseModel):
    """补聚类输出：把首次聚类漏归的论文定向归入现有维度或新建维度。"""
    index: int
    dimension: int | str = Field(description="现有维度序号（0 基）或新维度名")


class ReviewAssignments(BaseModel):
    assignments: list[ReviewAssignment] = Field(default_factory=list)


class ReviewFindingsItem(BaseModel):
    claim: str
    sources: list[int] = Field(default_factory=list)
    conflict: bool = False


class ReviewFindings(BaseModel):
    """核心发现面板输出。"""
    findings: list[ReviewFindingsItem] = Field(default_factory=list)


class ReviewAttributes(BaseModel):
    """对比表属性提取输出。"""
    attributes: list[str] = Field(default_factory=list)


class ReviewTableRow(BaseModel):
    index: int = Field(description="论文全局编号")
    values: dict[str, str] = Field(default_factory=dict)


class ReviewTable(BaseModel):
    """对比表填值输出（一致性 pass 后最终采用）。"""
    rows: list[ReviewTableRow] = Field(default_factory=list)


class ReviewTimelinePhase(BaseModel):
    name: str = ""
    start: int
    end: int
    papers: list[int] = Field(default_factory=list)


class ReviewTimeline(BaseModel):
    """研究脉络时间线输出。"""
    phases: list[ReviewTimelinePhase] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# 全局意图 / 任务规划
# --------------------------------------------------------------------------- #
class Intent(BaseModel):
    task_type: str
    required_agents: list[str]
    description: str


class TaskStep(BaseModel):
    step: int
    agent: str
    action: str


class TaskPlan(BaseModel):
    steps: list[TaskStep] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Supervisor 控制平面：只允许路由到已注册 agent 和已登记工具。
# --------------------------------------------------------------------------- #
AgentName = Literal["scout", "synthesis", "librarian", "research_design", "code_assistant", "writer", "critic"]
ToolName = Literal["vector_rag", "graph_rag", "pdf_parser", "graph_expand", "venue_db", "evidence_check", "dpo_align", "evidence_retrieve", "pdf_ingest"]


class SupervisorStep(BaseModel):
    agent: AgentName
    action: str = Field(min_length=1)
    authorized_tools: list[ToolName] = Field(default_factory=list)


class SupervisorDecision(BaseModel):
    """LLM 对用户输入、工作状态和全局记忆生成的受约束控制决策。"""
    task_type: str = Field(min_length=1)
    description: str = Field(min_length=1)
    steps: list[SupervisorStep] = Field(min_length=1, max_length=12)


# --------------------------------------------------------------------------- #
# 各 agent 规划阶段 Schema：LLM 先产出执行计划，再由工具执行。
# mock 模式下由确定性函数回显计划，真实模式下由 LLM 生成。
# --------------------------------------------------------------------------- #
class ScoutQueryPlan(BaseModel):
    core_topics: list[str] = Field(default_factory=list)
    time_range: list[int] = Field(default_factory=list, description="[start_year, end_year]")
    venue_level: str | None = None
    domain: str | None = None
    author: str | None = None
    sub_queries: list[str] = Field(default_factory=list, description="3 个不同粒度的子查询")
    checklist: list[str] = Field(default_factory=list)


class SynthesisPlan(BaseModel):
    paper_ids: list[str] = Field(default_factory=list)
    extraction_schema: list[str] = Field(default_factory=list)


class LibrarianPlan(BaseModel):
    seed_paper_ids: list[str] = Field(default_factory=list)
    graph_type: Literal["co-citation", "bibliographic_coupling"] = "co-citation"
    depth: int = 2


class WriterPlan(BaseModel):
    section_type: Literal["Abstract", "Introduction", "Related Work", "Method", "Experiment"] = "Abstract"
    style_preference: Literal["IEEE", "ACM", "Nature", "CVPR"] = "IEEE"
    cited_paper_ids: list[str] = Field(default_factory=list)


class CriticPlan(BaseModel):
    target_venue: str | None = None
    checklist: list[str] = Field(default_factory=lambda: ["hallucination_check", "format_check", "novelty_check"])


AGENT_OUTPUT = {
    "scout": ScoutOutput,
    "synthesis": SynthesisOutput,
    "librarian": LibrarianOutput,
    "research_design": ResearchDesignOutput,
    "code_assistant": CodeAssistantOutput,
    "writer": WriterOutput,
    "critic": CriticOutput,
}
