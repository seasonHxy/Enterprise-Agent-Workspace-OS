import { requiresApproval, validateCapabilities } from './policy'
import type { AgentApp, AgentRun, AuditEvent, Capability, RunPhase, RuntimeKind, WorkflowMatch } from './types'

export interface RunResult {
  run: AgentRun
  audit: AuditEvent
}

export interface AgentRuntime {
  kind: RuntimeKind
  start(app: AgentApp, context?: RunContext): RunResult
}

export interface RunContext {
  workflowMatch?: WorkflowMatch
  knowledgeSources?: AgentRun['knowledgeSources']
}

export interface ApprovalTransition {
  run: AgentRun
  completed: boolean
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function nextCapability(app: AgentApp): Capability | undefined {
  return app.capabilities.find(requiresApproval)
}

export function createRunPhases(waiting: boolean, workflowMatch?: WorkflowMatch): RunPhase[] {
  return [
    {
      id: 'recall',
      label: 'Recall · 检索经验',
      detail: workflowMatch
        ? `已命中「${workflowMatch.title}」并提取可复用步骤`
        : '未发现足够相似的历史流程，本次从标准模板开始',
      status: 'completed',
    },
    { id: 'policy', label: 'Policy · 校验边界', detail: '运行时与 Capability 清单已通过 fail-closed 校验', status: 'completed' },
    {
      id: 'approval',
      label: 'Gate · 权限决策',
      detail: waiting ? '等待用户批准本次敏感操作' : '当前步骤仅使用自动批准的低风险能力',
      status: waiting ? 'active' : 'completed',
    },
    {
      id: 'execute',
      label: 'Execute · 执行计划',
      detail: waiting ? '将在授权后进入隔离运行时' : '正在隔离运行时逐步执行模板计划',
      status: waiting ? 'pending' : 'active',
    },
    { id: 'reflect', label: 'Reflect · 沉淀经验', detail: '完成后更新流程步骤、结果和复用次数', status: 'pending' },
  ]
}

export function finishRunPhases(phases: RunPhase[] = [], approved = true): RunPhase[] {
  const completedDetails: Partial<Record<RunPhase['id'], string>> = {
    approval: '本次所需敏感权限已逐项批准',
    execute: '执行计划已在隔离运行时完成',
    reflect: '步骤、结果和复用次数已写入流程记忆',
  }
  return phases.map((phase) => ({
    ...phase,
    detail: !approved && phase.id === 'approval'
      ? '用户拒绝本次权限，执行已安全停止'
      : approved && completedDetails[phase.id]
        ? completedDetails[phase.id] ?? phase.detail
        : phase.detail,
    status: !approved && ['approval', 'execute', 'reflect'].includes(phase.id)
      ? 'blocked'
      : 'completed',
  }))
}

export function advanceRunApproval(app: AgentApp, run: AgentRun, approved: boolean): ApprovalTransition {
  const currentCapability = run.capability
  if (!approved) {
    return {
      completed: false,
      run: {
        ...run,
        status: 'failed',
        summary: '用户拒绝权限，任务已安全停止。',
        capability: undefined,
        phases: finishRunPhases(run.phases, false),
      },
    }
  }

  const approvedCapabilityIds = currentCapability
    ? [...new Set([...(run.approvedCapabilityIds ?? []), currentCapability.id])]
    : run.approvedCapabilityIds ?? []
  const remainingIds = run.pendingCapabilityIds
    ? run.pendingCapabilityIds.filter((id) => !approvedCapabilityIds.includes(id))
    : []
  const nextCapability = app.capabilities.find((capability) => capability.id === remainingIds[0])

  if (nextCapability) {
    return {
      completed: false,
      run: {
        ...run,
        status: 'waiting',
        progress: Math.min(86, run.progress + 28),
        summary: `已批准 ${currentCapability?.label ?? '当前权限'}；等待授权：${nextCapability.label}`,
        capability: nextCapability,
        approvedCapabilityIds,
        phases: run.phases?.map((phase) => phase.id === 'approval' ? {
          ...phase,
          detail: `已批准 ${approvedCapabilityIds.length} 项；等待 ${nextCapability.label}`,
          status: 'active',
        } : phase),
      },
    }
  }

  return {
    completed: true,
    run: {
      ...run,
      status: 'completed',
      progress: 100,
      summary: '所有敏感权限已逐项批准，任务完成。',
      capability: undefined,
      approvedCapabilityIds,
      phases: finishRunPhases(run.phases),
    },
  }
}

abstract class BaseRuntime implements AgentRuntime {
  abstract kind: RuntimeKind

  start(app: AgentApp, context: RunContext = {}): RunResult {
    const errors = validateCapabilities(app.capabilities, this.kind)
    if (errors.length > 0) throw new Error(errors[0])

    const capability = nextCapability(app)
    const pendingCapabilityIds = app.capabilities.filter(requiresApproval).map((item) => item.id)
    const waiting = Boolean(capability)
    const runId = makeId('run')

    return {
      run: {
        id: runId,
        appId: app.id,
        appName: app.name,
        runtime: this.kind,
        status: waiting ? 'waiting' : 'running',
        summary: waiting
          ? `等待授权：${capability?.label}`
          : this.kind === 'local'
            ? '正在本机隔离工作区执行'
            : '正在云端沙箱执行',
        progress: waiting ? 24 : 48,
        startedAt: new Date().toISOString(),
        capability,
        pendingCapabilityIds,
        approvedCapabilityIds: [],
        workflowMatch: context.workflowMatch,
        workflowPlan: app.workflowSteps ?? ['理解目标和输入', '执行任务并保留证据', '校验结果', '输出并沉淀经验'],
        workflowVersion: app.version ?? 1,
        phases: createRunPhases(waiting, context.workflowMatch),
        knowledgeSources: context.knowledgeSources,
      },
      audit: {
        id: makeId('audit'),
        runId,
        action: waiting ? `请求 ${capability?.label}` : `启动 ${app.name}`,
        outcome: waiting ? 'blocked' : 'allowed',
        risk: capability?.risk ?? 0,
        timestamp: new Date().toISOString(),
      },
    }
  }
}

export class LocalRuntime extends BaseRuntime {
  kind = 'local' as const
}

export class CloudRuntime extends BaseRuntime {
  kind = 'cloud' as const
}

export function getRuntime(kind: RuntimeKind): AgentRuntime {
  return kind === 'local' ? new LocalRuntime() : new CloudRuntime()
}
