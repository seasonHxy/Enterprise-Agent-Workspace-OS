import { requiresApproval, validateCapabilities } from './policy'
import type {
  AgentApp,
  AgentAppVersion,
  Capability,
  WorkflowPreflightCheck,
  WorkflowUpdate,
} from './types'

function snapshot(app: AgentApp, changeNote: string, createdAt: string): AgentAppVersion {
  return {
    id: `version-${app.id}-${app.version ?? 1}-${createdAt}`,
    version: app.version ?? 1,
    name: app.name,
    description: app.description,
    prompt: app.prompt,
    runtime: app.runtime,
    capabilityIds: app.capabilities.map((capability) => capability.id),
    workflowSteps: app.workflowSteps ?? [],
    schedule: app.schedule,
    changeNote,
    createdAt,
  }
}

function initialSnapshot(app: AgentApp): AgentAppVersion {
  const createdAt = app.createdAt
  return {
    ...snapshot({ ...app, version: 1 }, '初始版本', createdAt),
    id: `version-${app.id}-1-initial`,
  }
}

export function getWorkflowHistory(app: AgentApp): AgentAppVersion[] {
  if (app.versions?.length) return app.versions
  return [initialSnapshot(app)]
}

export function updateAgentWorkflow(
  app: AgentApp,
  update: WorkflowUpdate,
  capabilityCatalog: Capability[],
  now = new Date(),
): AgentApp {
  const createdAt = now.toISOString()
  const version = (app.version ?? 1) + 1
  const capabilities = capabilityCatalog.filter((capability) => update.capabilityIds.includes(capability.id))
  const next: AgentApp = {
    ...app,
    name: update.name.trim(),
    description: update.description.trim(),
    prompt: update.prompt.trim(),
    runtime: update.runtime,
    capabilities,
    workflowSteps: update.workflowSteps.map((step) => step.trim()).filter(Boolean),
    schedule: update.schedule?.trim() || undefined,
    version,
    updatedAt: createdAt,
  }
  const currentHistory = getWorkflowHistory(app)
  return {
    ...next,
    versions: [...currentHistory, snapshot(next, update.changeNote.trim() || '更新工作流', createdAt)],
  }
}

export function restoreAgentWorkflow(
  app: AgentApp,
  versionId: string,
  capabilityCatalog: Capability[],
  now = new Date(),
): AgentApp {
  const target = getWorkflowHistory(app).find((version) => version.id === versionId)
  if (!target) return app
  return updateAgentWorkflow(app, {
    name: target.name,
    description: target.description,
    prompt: target.prompt,
    runtime: target.runtime,
    capabilityIds: target.capabilityIds,
    workflowSteps: target.workflowSteps,
    schedule: target.schedule,
    changeNote: `恢复自 v${target.version}`,
  }, capabilityCatalog, now)
}

export function getWorkflowPreflight(app: AgentApp): WorkflowPreflightCheck[] {
  const policyErrors = validateCapabilities(app.capabilities, app.runtime)
  const protectedCapabilities = app.capabilities.filter(requiresApproval)
  const steps = app.workflowSteps ?? []
  return [
    {
      id: 'runtime',
      label: '执行面与资源边界',
      detail: policyErrors[0] ?? `${app.runtime === 'local' ? 'Local Runner' : 'Cloud Sandbox'} 与全部资源兼容`,
      status: policyErrors.length ? 'blocked' : 'pass',
    },
    {
      id: 'workflow',
      label: '工作流计划',
      detail: steps.length >= 2 ? `将按 v${app.version ?? 1} 的 ${steps.length} 个步骤执行` : '尚未配置完整步骤，将按目标动态规划',
      status: steps.length >= 2 ? 'pass' : 'attention',
    },
    {
      id: 'capabilities',
      label: 'Capability 审批',
      detail: protectedCapabilities.length
        ? `${protectedCapabilities.length} 项敏感权限会在使用前逐项请求授权`
        : '所需权限均为公共只读或无需外部资源',
      status: protectedCapabilities.length ? 'approval' : 'pass',
    },
    {
      id: 'memory',
      label: '流程记忆',
      detail: '只检索相似步骤与结果，不复用历史授权',
      status: 'pass',
    },
  ]
}

export function canStartWorkflow(app: AgentApp): boolean {
  return !getWorkflowPreflight(app).some((check) => check.status === 'blocked')
}
