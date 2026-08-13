import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedWorkspace } from '../src/core/seed'
import { loadWorkspace } from '../src/core/storage'

describe('workspace migrations', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('backfills workflow fields for apps saved by older versions', () => {
    const legacy = {
      ...seedWorkspace,
      apps: seedWorkspace.apps.map((app) => ({
        id: app.id,
        name: app.name,
        description: app.description,
        prompt: app.prompt,
        runtime: app.runtime,
        status: app.status,
        capabilities: app.capabilities,
        schedule: app.schedule,
        createdAt: app.createdAt,
      })),
    }
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(legacy) })
    const loaded = loadWorkspace(seedWorkspace)
    expect(loaded.apps[0].workflowSteps).toEqual(seedWorkspace.apps[0].workflowSteps)
    expect(loaded.apps[0].version).toBe(1)
    expect(loaded.apps[0].templateId).toBe(seedWorkspace.apps[0].templateId)
  })

  it('adds newly bundled enterprise workflows without deleting user apps', () => {
    const userOnly = { ...seedWorkspace, apps: [{ ...seedWorkspace.apps[0], id: 'user-app', name: '用户应用' }] }
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(userOnly) })
    const loaded = loadWorkspace(seedWorkspace)
    expect(loaded.apps.some((app) => app.id === 'app-enterprise-solution')).toBe(true)
    expect(loaded.apps.some((app) => app.id === 'user-app')).toBe(true)
  })
})
