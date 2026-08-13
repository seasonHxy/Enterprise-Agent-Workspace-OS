import type { WorkspaceState } from './types'

const STORAGE_KEY = 'awos-workspace-v1'

export function loadWorkspace(fallback: WorkspaceState): WorkspaceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const stored = JSON.parse(raw) as WorkspaceState
    const migratedApps = stored.apps.map((app) => {
      const seeded = fallback.apps.find((candidate) => candidate.id === app.id)
      return {
        ...app,
        templateId: app.templateId ?? seeded?.templateId,
        workflowSteps: app.workflowSteps ?? seeded?.workflowSteps,
        version: app.version ?? seeded?.version ?? 1,
      }
    })
    const missingSeedApps = fallback.apps.filter((seeded) => !migratedApps.some((app) => app.id === seeded.id))
    return {
      ...stored,
      apps: [...missingSeedApps, ...migratedApps],
    }
  } catch {
    return fallback
  }
}

export function saveWorkspace(state: WorkspaceState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
