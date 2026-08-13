import { validateCapabilities } from './policy'
import type { AgentApp } from './types'

export type EnterpriseIntegrationState = 'ready' | 'demo' | 'pending' | 'error'

export interface EnterpriseIntegration {
  id: 'identity' | 'knowledge' | 'memory' | 'audit'
  label: string
  status: EnterpriseIntegrationState
  detail: string
}

export interface EnterpriseStatus {
  mode: 'local' | 'enterprise'
  health: 'ready' | 'degraded' | 'checking'
  organization: { id: string; name: string }
  identity: { name: string; email: string; roles: string[]; groups: string[] }
  integrations: EnterpriseIntegration[]
}

export interface EnterprisePreflightResult {
  allowed: boolean
  errors: string[]
  tenantId: string
  subject: string
  checkedAt: string
}

export interface EnterpriseKnowledgeResult {
  id: string
  title: string
  excerpt: string
  source: string
  url?: string
  updatedAt: string
}

export interface EnterpriseGateway {
  status(): Promise<EnterpriseStatus>
  preflight(app: AgentApp): Promise<EnterprisePreflightResult>
  searchKnowledge(query: string, limit?: number): Promise<EnterpriseKnowledgeResult[]>
}

export const localEnterpriseStatus: EnterpriseStatus = {
  mode: 'local',
  health: 'degraded',
  organization: { id: 'personal', name: 'Personal Workspace' },
  identity: { name: 'Local User', email: 'local@workspace', roles: ['owner'], groups: ['personal'] },
  integrations: [
    { id: 'identity', label: '企业身份与 RBAC', status: 'demo', detail: '尚未连接企业身份代理' },
    { id: 'knowledge', label: '企业知识检索', status: 'demo', detail: '尚未连接带 ACL 的内部知识源' },
    { id: 'memory', label: 'Letta 流程记忆', status: 'demo', detail: '由 Memory 页面显示当前提供方状态' },
    { id: 'audit', label: '持久化审计', status: 'pending', detail: '当前审计记录保存在浏览器工作区' },
  ],
}

class LocalEnterpriseGateway implements EnterpriseGateway {
  async status(): Promise<EnterpriseStatus> {
    return localEnterpriseStatus
  }

  async preflight(app: AgentApp): Promise<EnterprisePreflightResult> {
    const errors = validateCapabilities(app.capabilities, app.runtime)
    return {
      allowed: errors.length === 0,
      errors,
      tenantId: 'personal',
      subject: 'local-user',
      checkedAt: new Date().toISOString(),
    }
  }

  async searchKnowledge(): Promise<EnterpriseKnowledgeResult[]> {
    return []
  }
}

class RemoteEnterpriseGateway implements EnterpriseGateway {
  constructor(private readonly apiUrl: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.apiUrl}${path}`, {
      credentials: 'include',
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
    })
    const payload = await response.json().catch(() => ({})) as { error?: string }
    if (!response.ok) throw new Error(payload.error || `Enterprise Gateway 返回 ${response.status}`)
    return payload as T
  }

  status(): Promise<EnterpriseStatus> {
    return this.request('/api/enterprise/status')
  }

  preflight(app: AgentApp): Promise<EnterprisePreflightResult> {
    return this.request('/api/runs/preflight', { method: 'POST', body: JSON.stringify({ app }) })
  }

  async searchKnowledge(query: string, limit = 8): Promise<EnterpriseKnowledgeResult[]> {
    const response = await this.request<{ results: EnterpriseKnowledgeResult[] }>('/api/knowledge/search', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    })
    return response.results
  }
}

export function createEnterpriseGateway(): EnterpriseGateway {
  const configuredUrl = import.meta.env.VITE_ENTERPRISE_API_URL?.trim()
  return configuredUrl
    ? new RemoteEnterpriseGateway(configuredUrl.replace(/\/$/, ''))
    : new LocalEnterpriseGateway()
}

export function degradedEnterpriseStatus(detail: string): EnterpriseStatus {
  return {
    ...localEnterpriseStatus,
    health: 'degraded',
    organization: { id: 'unavailable', name: 'Enterprise Gateway unavailable' },
    integrations: localEnterpriseStatus.integrations.map((integration) => ({
      ...integration,
      status: 'error',
      detail,
    })),
  }
}
