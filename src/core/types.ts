export type View = 'ask' | 'build' | 'run' | 'memory' | 'workspace'

export type RuntimeKind = 'local' | 'cloud'

export type RiskLevel = 0 | 1 | 2 | 3 | 4

export type CapabilityMode = 'read' | 'write' | 'execute'

export type ApprovalPolicy = 'automatic' | 'first-use' | 'every-time' | 'two-person'

export interface Capability {
  id: string
  label: string
  description: string
  resource: string
  scope: string
  mode: CapabilityMode
  risk: RiskLevel
  approval: ApprovalPolicy
}

export interface AgentApp {
  id: string
  name: string
  description: string
  prompt: string
  runtime: RuntimeKind
  status: 'draft' | 'ready'
  capabilities: Capability[]
  templateId?: string
  workflowSteps?: string[]
  version?: number
  versions?: AgentAppVersion[]
  schedule?: string
  createdAt: string
  updatedAt?: string
}

export interface AgentAppVersion {
  id: string
  version: number
  name: string
  description: string
  prompt: string
  runtime: RuntimeKind
  capabilityIds: string[]
  workflowSteps: string[]
  schedule?: string
  changeNote: string
  createdAt: string
}

export interface WorkflowUpdate {
  name: string
  description: string
  prompt: string
  runtime: RuntimeKind
  capabilityIds: string[]
  workflowSteps: string[]
  schedule?: string
  changeNote: string
}

export type PreflightStatus = 'pass' | 'approval' | 'attention' | 'blocked'

export interface WorkflowPreflightCheck {
  id: 'runtime' | 'workflow' | 'capabilities' | 'memory'
  label: string
  detail: string
  status: PreflightStatus
}

export type RunStatus = 'running' | 'waiting' | 'completed' | 'failed'

export interface AgentRun {
  id: string
  appId: string
  appName: string
  runtime: RuntimeKind
  status: RunStatus
  summary: string
  progress: number
  startedAt: string
  capability?: Capability
  pendingCapabilityIds?: string[]
  approvedCapabilityIds?: string[]
  workflowMatch?: WorkflowMatch
  workflowPlan?: string[]
  workflowVersion?: number
  phases?: RunPhase[]
  knowledgeSources?: KnowledgeSource[]
}

export interface KnowledgeSource {
  id: string
  title: string
  excerpt: string
  source: string
  url?: string
  updatedAt: string
}

export type RunPhaseStatus = 'completed' | 'active' | 'pending' | 'blocked'

export interface RunPhase {
  id: 'recall' | 'policy' | 'approval' | 'execute' | 'reflect'
  label: string
  detail: string
  status: RunPhaseStatus
}

export type WorkflowTemplateCategory = 'research' | 'engineering' | 'operations' | 'content'

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: WorkflowTemplateCategory
  prompt: string
  expectedOutput: string
  runtime: RuntimeKind
  capabilityIds: string[]
  steps: string[]
  schedule?: string
}

export type MemoryProviderKind = 'local' | 'letta'

export type WorkflowOutcome = 'success' | 'blocked'

export interface WorkflowMemory {
  id: string
  passageId?: string
  fingerprint: string
  appId: string
  appName: string
  title: string
  goal: string
  summary: string
  runtime: RuntimeKind
  capabilityIds: string[]
  capabilityLabels: string[]
  steps: string[]
  tags: string[]
  outcome: WorkflowOutcome
  runCount: number
  successCount: number
  createdAt: string
  lastUsedAt: string
  provider: MemoryProviderKind
}

export interface WorkflowMatch {
  memoryId: string
  title: string
  score: number
  matchedSignals: string[]
  steps: string[]
  provider: MemoryProviderKind
}

export interface MemoryStatus {
  provider: MemoryProviderKind
  health: 'ready' | 'degraded' | 'checking'
  label: string
  detail: string
}

export interface AuditEvent {
  id: string
  runId: string
  action: string
  outcome: 'allowed' | 'blocked' | 'approved' | 'denied'
  risk: RiskLevel
  timestamp: string
}

export interface WorkspaceState {
  apps: AgentApp[]
  runs: AgentRun[]
  audits: AuditEvent[]
}
