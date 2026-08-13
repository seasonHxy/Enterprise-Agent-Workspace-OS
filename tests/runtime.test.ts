import { describe, expect, it } from 'vitest'
import { advanceRunApproval, CloudRuntime, finishRunPhases, LocalRuntime } from '../src/core/runtime'
import { seedApps } from '../src/core/seed'

describe('agent runtimes', () => {
  it('starts a public research app without approval', () => {
    const result = new CloudRuntime().start(seedApps[0], { knowledgeSources: [{
      id: 'doc-1', title: '企业知识', excerpt: '有权片段', source: 'RAG', updatedAt: '2026-08-13T00:00:00.000Z',
    }] })
    expect(result.run.status).toBe('running')
    expect(result.run.runtime).toBe('cloud')
    expect(result.audit.outcome).toBe('allowed')
    expect(result.run.phases?.find((phase) => phase.id === 'execute')?.status).toBe('active')
    expect(result.run.workflowPlan).toHaveLength(4)
    expect(result.run.workflowVersion).toBe(1)
    expect(result.run.knowledgeSources?.[0].title).toBe('企业知识')
  })

  it('pauses a local app at its first protected capability', () => {
    const result = new LocalRuntime().start(seedApps[1])
    expect(result.run.status).toBe('waiting')
    expect(result.run.capability?.resource).toBe('local-files')
    expect(result.audit.outcome).toBe('blocked')
    expect(result.run.phases?.find((phase) => phase.id === 'approval')?.status).toBe('active')
  })

  it('fails closed when cloud execution asks for local files', () => {
    const unsafeApp = { ...seedApps[1], runtime: 'cloud' as const }
    expect(() => new CloudRuntime().start(unsafeApp)).toThrow('不能在云端运行')
  })

  it('marks remaining phases blocked after a denied approval', () => {
    const phases = new LocalRuntime().start(seedApps[1]).run.phases
    const finished = finishRunPhases(phases, false)
    expect(finished.find((phase) => phase.id === 'approval')?.status).toBe('blocked')
    expect(finished.find((phase) => phase.id === 'reflect')?.status).toBe('blocked')
  })

  it('approves multiple protected capabilities one at a time', () => {
    const started = new LocalRuntime().start(seedApps[1]).run
    const first = advanceRunApproval(seedApps[1], started, true)
    expect(first.run.status).toBe('waiting')
    expect(first.run.capability?.id).toBe('github-write')
    expect(first.run.approvedCapabilityIds).toEqual(['workspace-files'])

    const second = advanceRunApproval(seedApps[1], first.run, true)
    expect(second.completed).toBe(true)
    expect(second.run.status).toBe('completed')
    expect(second.run.approvedCapabilityIds).toEqual(['workspace-files', 'github-write'])
    expect(second.run.phases?.find((phase) => phase.id === 'execute')?.detail).toContain('已在隔离运行时完成')
  })
})
