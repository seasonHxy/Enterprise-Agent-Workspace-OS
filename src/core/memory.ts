import type {
  AgentApp,
  AgentRun,
  MemoryProviderKind,
  WorkflowMatch,
  WorkflowMemory,
} from './types'

export const WORKFLOW_MEMORY_PREFIX = '[AWOS_WORKFLOW_V1]'

const commonWords = new Set([
  'agent', 'app', 'the', 'and', 'with', 'from', 'this', 'that',
  '一个', '进行', '生成', '完成', '任务', '工作', '流程', '使用', '指定', '输出',
])

function hash(value: string): string {
  let result = 2166136261
  for (const character of value) {
    result ^= character.charCodeAt(0)
    result = Math.imul(result, 16777619)
  }
  return (result >>> 0).toString(36)
}

export function tokenize(value: string): string[] {
  const normalized = value.toLowerCase().normalize('NFKC')
  const latin = normalized.match(/[a-z0-9][a-z0-9_-]{1,}/g) ?? []
  const chineseChunks = normalized.match(/[\u3400-\u9fff]+/g) ?? []
  const chinese = chineseChunks.flatMap((chunk) => {
    if (chunk.length < 2) return [chunk]
    return Array.from({ length: chunk.length - 1 }, (_, index) => chunk.slice(index, index + 2))
  })
  return [...new Set([...latin, ...chinese].filter((word) => !commonWords.has(word)))]
}

function overlap(left: string[], right: string[]): string[] {
  const rightSet = new Set(right)
  return [...new Set(left.filter((item) => rightSet.has(item)))]
}

function jaccard(left: string[], right: string[]): number {
  const union = new Set([...left, ...right])
  return union.size === 0 ? 0 : overlap(left, right).length / union.size
}

export function fingerprintApp(app: AgentApp): string {
  const signature = [
    app.runtime,
    ...app.capabilities.map((capability) => capability.id).sort(),
    ...tokenize(`${app.name} ${app.description} ${app.prompt}`).sort(),
  ].join('|')
  return `wf-${hash(signature)}`
}

export function workflowQuery(app: AgentApp): string {
  return [
    app.name,
    app.description,
    app.prompt,
    app.capabilities.map((capability) => capability.label).join(' '),
    app.runtime,
  ].join(' ')
}

export function scoreWorkflow(app: AgentApp, memory: WorkflowMemory): WorkflowMatch {
  const appTokens = tokenize(workflowQuery(app))
  const memoryTokens = tokenize([
    memory.title,
    memory.goal,
    memory.summary,
    memory.tags.join(' '),
    memory.capabilityLabels.join(' '),
  ].join(' '))
  const capabilityOverlap = overlap(
    app.capabilities.map((capability) => capability.id),
    memory.capabilityIds,
  )
  const exactFingerprint = fingerprintApp(app) === memory.fingerprint
  const runtimeMatch = app.runtime === memory.runtime
  const semanticScore = jaccard(appTokens, memoryTokens)
  const matchedTags = memory.tags.filter((tag) => overlap(appTokens, tokenize(tag)).length > 0)
  const score = Math.min(1,
    semanticScore * 0.56
      + (capabilityOverlap.length > 0 ? 0.2 : 0)
      + (runtimeMatch ? 0.09 : 0)
      + (memory.outcome === 'success' ? 0.05 : 0)
      + (exactFingerprint ? 0.32 : 0),
  )

  const signals = [
    ...matchedTags.slice(0, 2),
    ...(semanticScore >= 0.08 && matchedTags.length === 0 ? ['目标语义'] : []),
    ...(capabilityOverlap.length > 0 ? ['相同能力'] : []),
    ...(runtimeMatch ? [`${app.runtime === 'local' ? '本地' : '云端'}运行时`] : []),
    ...(exactFingerprint ? ['相同流程指纹'] : []),
  ]

  return {
    memoryId: memory.id,
    title: memory.title,
    score: Number(score.toFixed(2)),
    matchedSignals: [...new Set(signals)],
    steps: memory.steps,
    provider: memory.provider,
  }
}

export function findSimilarWorkflows(
  app: AgentApp,
  memories: WorkflowMemory[],
  limit = 3,
): WorkflowMatch[] {
  return memories
    .filter((memory) => memory.outcome === 'success')
    .map((memory) => scoreWorkflow(app, memory))
    .filter((match) => match.score >= 0.42)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
}

export function captureWorkflow(
  app: AgentApp,
  run: AgentRun,
  provider: MemoryProviderKind = 'local',
): WorkflowMemory {
  const now = new Date().toISOString()
  const capabilityLabels = app.capabilities.map((capability) => capability.label)
  const steps = [
    ...(run.workflowPlan ?? app.workflowSteps ?? [
      `载入「${app.name}」的目标与运行清单`,
      capabilityLabels.length > 0
        ? `按最小权限申请：${capabilityLabels.join('、')}`
        : `在${app.runtime === 'local' ? '本地' : '云端'}隔离环境执行`,
      run.workflowMatch ? `参考历史流程「${run.workflowMatch.title}」` : '执行任务并保留关键中间结果',
      '写入审计事件，保存可复用步骤与结果',
    ]),
  ]

  return {
    id: `memory-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fingerprint: fingerprintApp(app),
    appId: app.id,
    appName: app.name,
    title: `${app.name} · 成功流程`,
    goal: app.prompt,
    summary: run.summary,
    runtime: app.runtime,
    capabilityIds: app.capabilities.map((capability) => capability.id),
    capabilityLabels,
    steps,
    tags: [...tokenize(`${app.name} ${app.description}`).slice(0, 5), app.runtime],
    outcome: run.status === 'failed' ? 'blocked' : 'success',
    runCount: 1,
    successCount: run.status === 'failed' ? 0 : 1,
    createdAt: now,
    lastUsedAt: now,
    provider,
  }
}

export function mergeWorkflowMemory(
  memories: WorkflowMemory[],
  incoming: WorkflowMemory,
): WorkflowMemory[] {
  const existing = memories.find((memory) => memory.fingerprint === incoming.fingerprint)
  if (!existing) return [incoming, ...memories]

  const merged: WorkflowMemory = {
    ...existing,
    ...incoming,
    id: existing.id,
    passageId: incoming.passageId ?? existing.passageId,
    createdAt: existing.createdAt,
    runCount: existing.runCount + 1,
    successCount: existing.successCount + incoming.successCount,
    lastUsedAt: incoming.lastUsedAt,
  }
  return [merged, ...memories.filter((memory) => memory.id !== existing.id)]
}

export function encodeWorkflowMemory(memory: WorkflowMemory): string {
  return `${WORKFLOW_MEMORY_PREFIX}\n${JSON.stringify(memory)}`
}

export function decodeWorkflowMemory(text: string): WorkflowMemory | null {
  if (!text.startsWith(WORKFLOW_MEMORY_PREFIX)) return null
  try {
    const memory = JSON.parse(text.slice(WORKFLOW_MEMORY_PREFIX.length).trim()) as WorkflowMemory
    return memory.id && memory.fingerprint && Array.isArray(memory.steps) ? memory : null
  } catch {
    return null
  }
}
