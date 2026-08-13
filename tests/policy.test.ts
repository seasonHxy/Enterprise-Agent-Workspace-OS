import { describe, expect, it } from 'vitest'
import { canRunInRuntime, defaultApproval, requiresApproval, validateCapabilities } from '../src/core/policy'
import { capabilityCatalog } from '../src/core/seed'

describe('capability policy', () => {
  it('maps risk levels to safe approval defaults', () => {
    expect(defaultApproval(0)).toBe('automatic')
    expect(defaultApproval(1)).toBe('automatic')
    expect(defaultApproval(2)).toBe('first-use')
    expect(defaultApproval(3)).toBe('every-time')
    expect(defaultApproval(4)).toBe('two-person')
  })

  it('never runs local file access in the cloud sandbox', () => {
    const localFiles = capabilityCatalog.find((item) => item.resource === 'local-files')!
    expect(canRunInRuntime(localFiles, 'cloud')).toBe(false)
    expect(validateCapabilities([localFiles], 'cloud')).toContain('工作区文件 不能在云端运行')
  })

  it('requires approval for every non-automatic capability', () => {
    expect(requiresApproval(capabilityCatalog[0])).toBe(false)
    expect(requiresApproval(capabilityCatalog[2])).toBe(true)
  })

  it('rejects an unsafe approval downgrade for L4 capabilities', () => {
    const unsafe = { ...capabilityCatalog[3], approval: 'automatic' as const }
    expect(validateCapabilities([unsafe], 'cloud')).toContain('生产环境部署 必须使用双人审批')
  })
})
