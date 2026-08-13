import { describe, expect, it } from 'vitest'
import { validateCapabilities } from '../src/core/policy'
import { createAppFromTemplate, workflowTemplates } from '../src/core/templates'

describe('workflow templates', () => {
  it('ships four distinct repeatable-work categories', () => {
    expect(workflowTemplates).toHaveLength(4)
    expect(new Set(workflowTemplates.map((template) => template.category)).size).toBe(4)
  })

  it('creates a runnable app with steps and least-privilege capabilities', () => {
    const template = workflowTemplates.find((item) => item.id === 'template-release')!
    const app = createAppFromTemplate(template, new Date('2026-08-13T08:00:00.000Z'))
    expect(app.templateId).toBe(template.id)
    expect(app.workflowSteps).toEqual(template.steps)
    expect(app.capabilities.map((capability) => capability.id)).toEqual(['workspace-files', 'github-write'])
    expect(validateCapabilities(app.capabilities, app.runtime)).toEqual([])
  })

  it('keeps every bundled template policy-valid', () => {
    for (const template of workflowTemplates) {
      const app = createAppFromTemplate(template)
      expect(validateCapabilities(app.capabilities, app.runtime)).toEqual([])
    }
  })
})
