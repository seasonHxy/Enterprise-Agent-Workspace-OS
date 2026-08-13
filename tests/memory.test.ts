import { describe, expect, it } from 'vitest'
import {
  captureWorkflow,
  decodeWorkflowMemory,
  encodeWorkflowMemory,
  findSimilarWorkflows,
  fingerprintApp,
  mergeWorkflowMemory,
  tokenize,
} from '../src/core/memory'
import { LocalWorkflowMemoryProvider } from '../src/core/memory-provider'
import { seedApps } from '../src/core/seed'
import { createAppFromTemplate, workflowTemplates } from '../src/core/templates'
import type { AgentRun } from '../src/core/types'

class MemoryStorage {
  private values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

const completedRun: AgentRun = {
  id: 'run-memory-test',
  appId: seedApps[0].id,
  appName: seedApps[0].name,
  runtime: seedApps[0].runtime,
  status: 'completed',
  summary: '研究完成并生成周报。',
  progress: 100,
  startedAt: '2026-08-13T06:00:00.000Z',
}

describe('workflow memory', () => {
  it('tokenizes both Chinese bigrams and Latin terms', () => {
    expect(tokenize('GitHub 版本发布周报')).toEqual(expect.arrayContaining(['github', '版本', '发布', '周报']))
  })

  it('creates stable fingerprints for the same app manifest', () => {
    expect(fingerprintApp(seedApps[0])).toBe(fingerprintApp({ ...seedApps[0] }))
  })

  it('ranks a research memory above an unrelated release flow', async () => {
    const provider = new LocalWorkflowMemoryProvider(new MemoryStorage())
    const memories = await provider.list()
    const matches = findSimilarWorkflows(seedApps[0], memories)
    expect(matches[0].title).toContain('竞品动态周报')
    expect(matches[0].score).toBeGreaterThan(matches[1]?.score ?? 0)
  })

  it('does not recommend a workflow based only on shared runtime and capabilities', async () => {
    const provider = new LocalWorkflowMemoryProvider(new MemoryStorage())
    const incident = createAppFromTemplate(workflowTemplates.find((item) => item.id === 'template-incident-review')!)
    expect(await provider.search(incident)).toEqual([])
  })

  it('encodes a typed envelope that can be stored as a Letta passage', () => {
    const memory = captureWorkflow(seedApps[0], completedRun)
    expect(decodeWorkflowMemory(encodeWorkflowMemory(memory))).toEqual(memory)
    expect(decodeWorkflowMemory('ordinary text')).toBeNull()
  })

  it('merges repeated workflow executions instead of adding duplicates', () => {
    const memory = captureWorkflow(seedApps[0], completedRun)
    const merged = mergeWorkflowMemory([memory], { ...memory, id: 'new-id' })
    expect(merged).toHaveLength(1)
    expect(merged[0].runCount).toBe(2)
    expect(merged[0].successCount).toBe(2)
  })

  it('persists completed runs through the local fallback provider', async () => {
    const provider = new LocalWorkflowMemoryProvider(new MemoryStorage())
    await provider.remember(seedApps[0], completedRun)
    const memories = await provider.list()
    const captured = memories.find((memory) => memory.fingerprint === fingerprintApp(seedApps[0]))
    expect(captured?.summary).toContain('研究完成')
  })
})
