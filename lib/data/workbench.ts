/** Shared frontend contracts for the project workbench APIs. */

export type WorkbenchView = "overview" | "outline" | "thread" | "assets" | "report" | "log";
export type JumpableView = Exclude<WorkbenchView, "overview">;
export type Selection = { kind: "node" | "card" | "asset" | "phase"; id: string } | null;

export type OutlineKind = "question" | "hypothesis" | "evidence" | "conclusion" | "note";
export type NodeStatus = "open" | "supported" | "contested" | "done";

export interface OutlineNode {
  id: string;
  kind: OutlineKind;
  title: string;
  status: NodeStatus;
  detail?: string;
  aiNote?: string;
  assetRefs: string[];
  children: OutlineNode[];
}

export type ThreadCardKind =
  | "question"
  | "literature"
  | "hypothesis"
  | "experiment"
  | "result"
  | "analysis"
  | "conclusion"
  | "next"
  | "hint";

export type ResearchStageKey =
  | "plan"
  | "search"
  | "read"
  | "synthesize"
  | "design"
  | "code"
  | "run"
  | "report";

export type ResearchEngineStage = ResearchStageKey;

export interface ResearchThread {
  id: string;
  questionId: string;
  title: string;
  stage: string;
}

export interface ThreadCard {
  id: string;
  threadId: string;
  kind: ThreadCardKind;
  stage: ResearchStageKey;
  title: string;
  summary: string;
  status: "todo" | "doing" | "done";
  assetRefs: string[];
  nodeRef?: string;
  aiGenerated?: boolean;
  createdAt: string;
}

export type AssetKind = "paper" | "dataset" | "note" | "experiment";
export type AssetStatus = "unread" | "active" | "analyzed" | "archived";

export interface WorkbenchAsset {
  id: string;
  kind: AssetKind;
  title: string;
  meta: string;
  questionIds: string[];
  hypothesisIds: string[];
  status: AssetStatus;
  tags: string[];
  updatedAt: string;
  artifact?: {
    runId: string;
    stage: ResearchStageKey;
    kind: string;
    uri?: string | null;
    content: string | null;
    metadata: Record<string, unknown>;
  };
}

export type ResearchRunStatus = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";

export interface ResearchRun {
  id: string;
  projectId: string;
  objective: string;
  status: ResearchRunStatus;
  phase: string;
  engineStage: ResearchStageKey;
  progress: number;
  executor: string;
  controlRequested: "pause" | "cancel" | null;
  attempt: number;
  decision: {
    action?: string;
    reason?: string;
    progressed?: boolean;
    executionMode?: "mock" | "full" | "degraded" | "offline";
  } | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ResearchRunEvent {
  id: string;
  runId: string;
  kind: string;
  level: string;
  message: string;
  payload: Record<string, unknown>;
  sequence: number;
  createdAt: string;
}

export interface ResearchExperiment {
  id: string;
  runId: string;
  title: string;
  round: number;
  status: string;
  hypothesis: string | null;
  metrics: Record<string, unknown>;
  stdout: string;
  stderr: string;
  codeRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEntry {
  id: string;
  at: string;
  actor: "user" | "agent" | "system";
  type: "note" | "literature" | "data" | "task" | "summary";
  text: string;
  threadId?: string;
}

export interface WorkbenchOverview {
  focus: {
    questionId: string;
    question: string;
    recentDocs: string[];
    runningExperiments: string[];
  };
  blockers: { id: string; text: string; view: JumpableView }[];
  suggestions: { id: string; text: string; view: JumpableView }[];
}

export type AgentName =
  | "scout"
  | "librarian"
  | "synthesis"
  | "research_design"
  | "code_assistant"
  | "writer"
  | "critic";

export interface AgentTask {
  id: string;
  agent: AgentName;
  label: string;
  state: "queued" | "running" | "done";
}

export interface FlatNode extends OutlineNode {
  depth: number;
}

export function flattenOutline(nodes: OutlineNode[], depth = 0): FlatNode[] {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenOutline(node.children, depth + 1),
  ]);
}

export function formatDay(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}
