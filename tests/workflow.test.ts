import { describe, expect, it } from 'vitest'
import { capabilityCatalog, seedApps } from '../src/core/seed'
import { canStartWorkflow, getWorkflowHistory, getWorkflowPreflight, restoreAgentWorkflow, updateAgentWorkflow } from '../src/core/workflow'

describe('workflow lifecycle', () => {
  it('creates an immutable version when a workflow changes', () => {
    const updated = updateAgentWorkflow(seedApps[0], {
      name: '市场研究助手 Pro',
      description: seedApps[0].description,
      prompt: seedApps[0].prompt,
      runtime: 'cloud',
      capabilityIds: ['web-research'],
      workflowSteps: [...(seedApps[0].workflowSteps ?? []), '发送管理层摘要'],
      schedule: '每周二 10:00',
      changeNote: '增加摘要分发步骤',
    }, capabilityCatalog, new Date('2026-08-13T12:00:00.000Z'))

    expect(updated.version).toBe(2)
    expect(updated.versions).toHaveLength(2)
    expect(updated.versions?.[0].name).toBe('市场研究助手')
    expect(updated.versions?.[1].changeNote).toBe('增加摘要分发步骤')
    expect(updated.workflowSteps).toHaveLength(5)
  })

  it('restores an older snapshot as a new version', () => {
    const changed = updateAgentWorkflow(seedApps[0], {
      name: '临时名称',
      description: '临时用途',
      prompt: '临时目标',
      runtime: 'cloud',
      capabilityIds: ['web-research'],
      workflowSteps: ['临时步骤一', '临时步骤二'],
      changeNote: '实验版本',
    }, capabilityCatalog, new Date('2026-08-13T12:00:00.000Z'))
    const initialVersion = getWorkflowHistory(changed)[0]
    const restored = restoreAgentWorkflow(changed, initialVersion.id, capabilityCatalog, new Date('2026-08-13T13:00:00.000Z'))

    expect(restored.version).toBe(3)
    expect(restored.name).toBe(seedApps[0].name)
    expect(restored.versions?.at(-1)?.changeNote).toBe('恢复自 v1')
  })

  it('explains sequential approvals in preflight', () => {
    const checks = getWorkflowPreflight(seedApps[1])
    expect(checks.find((check) => check.id === 'capabilities')?.status).toBe('approval')
    expect(checks.find((check) => check.id === 'capabilities')?.detail).toContain('2 项敏感权限')
    expect(canStartWorkflow(seedApps[1])).toBe(true)
  })

  it('blocks an incompatible runtime before execution', () => {
    const unsafe = { ...seedApps[1], runtime: 'cloud' as const }
    expect(getWorkflowPreflight(unsafe).find((check) => check.id === 'runtime')?.status).toBe('blocked')
    expect(canStartWorkflow(unsafe)).toBe(false)
  })
})
