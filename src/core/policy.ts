import type { ApprovalPolicy, Capability, RiskLevel, RuntimeKind } from './types'

export const riskLabels: Record<RiskLevel, string> = {
  0: '仅对话',
  1: '公共只读',
  2: '受限数据',
  3: '外部写入',
  4: '高风险操作',
}

export const approvalLabels: Record<ApprovalPolicy, string> = {
  automatic: '自动执行',
  'first-use': '首次确认',
  'every-time': '每次确认',
  'two-person': '双人审批',
}

export function defaultApproval(risk: RiskLevel): ApprovalPolicy {
  if (risk <= 1) return 'automatic'
  if (risk === 2) return 'first-use'
  if (risk === 3) return 'every-time'
  return 'two-person'
}

export function requiresApproval(capability: Capability): boolean {
  return capability.approval !== 'automatic'
}

export function canRunInRuntime(capability: Capability, runtime: RuntimeKind): boolean {
  if (runtime === 'cloud' && capability.resource === 'local-files') return false
  if (runtime === 'local' && capability.risk === 4 && capability.approval === 'automatic') return false
  return true
}

export function validateCapabilities(
  capabilities: Capability[],
  runtime: RuntimeKind,
): string[] {
  const errors: string[] = []

  for (const capability of capabilities) {
    if (!capability.scope.trim()) errors.push(`${capability.label} 缺少作用域`)
    if (!canRunInRuntime(capability, runtime)) {
      errors.push(`${capability.label} 不能在${runtime === 'cloud' ? '云端' : '本地'}运行`)
    }
    if (capability.risk === 4 && capability.approval !== 'two-person') {
      errors.push(`${capability.label} 必须使用双人审批`)
    }
  }

  return errors
}
