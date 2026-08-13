import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { validateCapabilities } from '../src/core/policy'
import type { AgentApp } from '../src/core/types'
import {
  authorize,
  canReadKnowledgeDocument,
  createDemoIdentity,
  matchesKnowledgeQuery,
  type EnterpriseIdentity,
  type EnterpriseKnowledgeDocument,
  verifyIdentityAssertion,
} from './enterprise-core'

const port = Number(process.env.ENTERPRISE_GATEWAY_PORT ?? 8788)
const origin = process.env.AWOS_ORIGIN ?? 'http://localhost:4173'
const mode = process.env.AWOS_ENTERPRISE_AUTH_MODE === 'proxy' ? 'proxy' : 'demo'
const tenantId = process.env.AWOS_TENANT_ID?.trim() || 'tenant-demo'
const organizationName = process.env.AWOS_ORGANIZATION_NAME?.trim() || 'Demo Organization'
const identitySecret = process.env.AWOS_IDENTITY_HMAC_SECRET?.trim()
const knowledgeUrl = process.env.ENTERPRISE_KNOWLEDGE_SEARCH_URL?.trim()
const knowledgeToken = process.env.ENTERPRISE_KNOWLEDGE_TOKEN?.trim()

if (mode === 'proxy' && (!identitySecret || identitySecret.length < 32)) {
  throw new Error('Proxy auth mode requires AWOS_IDENTITY_HMAC_SECRET with at least 32 characters')
}

const demoDocuments: EnterpriseKnowledgeDocument[] = [
  {
    id: 'kb-product-private-deployment',
    title: '企业知识平台私有化部署规范',
    excerpt: '私有化项目必须包含 SSO、租户隔离、审计日志、备份恢复和数据保留策略。',
    source: 'Enterprise Handbook',
    tenantId,
    allowedGroups: ['product', 'sales'],
    updatedAt: '2026-08-01T08:00:00.000Z',
  },
  {
    id: 'kb-sales-solution-checklist',
    title: '客户解决方案交付检查清单',
    excerpt: '交付前确认客户规模、知识源、部署形态、审批人、预算和验收指标。',
    source: 'Sales Playbook',
    tenantId,
    allowedGroups: ['sales'],
    updatedAt: '2026-07-26T08:00:00.000Z',
  },
  {
    id: 'kb-finance-confidential',
    title: '年度预算内部草案',
    excerpt: '仅财务组可见。',
    source: 'Finance Drive',
    tenantId,
    allowedGroups: ['finance'],
    updatedAt: '2026-08-10T08:00:00.000Z',
  },
]

function publicKnowledgeDocument(document: EnterpriseKnowledgeDocument) {
  return {
    id: document.id,
    title: document.title,
    excerpt: document.excerpt,
    source: document.source,
    url: document.url,
    updatedAt: document.updatedAt,
  }
}

function applyCors(response: ServerResponse) {
  response.setHeader('access-control-allow-origin', origin)
  response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS')
  response.setHeader('access-control-allow-headers', 'content-type,x-awos-identity,x-awos-identity-signature')
  response.setHeader('access-control-allow-credentials', 'true')
  response.setHeader('vary', 'Origin')
}

function send(response: ServerResponse, status: number, body?: unknown) {
  applyCors(response)
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(body === undefined ? undefined : JSON.stringify(body))
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk)
    size += buffer.length
    if (size > 256_000) throw new Error('Request body exceeds 256 KB')
    chunks.push(buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch {
    throw new Error('Request body must be valid JSON')
  }
}

function getIdentity(request: IncomingMessage): EnterpriseIdentity {
  if (mode === 'demo') return createDemoIdentity(tenantId)
  const assertion = request.headers['x-awos-identity']
  const signature = request.headers['x-awos-identity-signature']
  return verifyIdentityAssertion(
    typeof assertion === 'string' ? assertion : undefined,
    typeof signature === 'string' ? signature : undefined,
    identitySecret!,
  )
}

async function searchKnowledge(identity: EnterpriseIdentity, query: string, limit: number) {
  authorize(identity, 'knowledge:read')
  if (!knowledgeUrl) {
    return demoDocuments
      .filter((document) => canReadKnowledgeDocument(identity, document))
      .filter((document) => matchesKnowledgeQuery(document, query))
      .slice(0, limit)
      .map(publicKnowledgeDocument)
  }

  const response = await fetch(knowledgeUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(knowledgeToken ? { authorization: `Bearer ${knowledgeToken}` } : {}),
    },
    body: JSON.stringify({ query, limit, tenantId: identity.tenantId, groups: identity.groups }),
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) throw new Error(`Knowledge adapter returned ${response.status}`)
  return response.json() as Promise<unknown>
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    applyCors(response)
    response.statusCode = 204
    response.end()
    return
  }

  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
    if (request.method === 'GET' && url.pathname === '/healthz') {
      send(response, 200, { status: 'ok' })
      return
    }

    const identity = getIdentity(request)
    if (identity.tenantId !== tenantId) {
      send(response, 403, { error: 'Identity tenant does not match this workspace' })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/enterprise/status') {
      send(response, 200, {
        mode: 'enterprise',
        health: 'ready',
        organization: { id: tenantId, name: organizationName },
        identity: {
          name: identity.name,
          email: identity.email,
          roles: identity.roles,
          groups: identity.groups,
        },
        integrations: [
          { id: 'identity', label: '企业身份与 RBAC', status: mode === 'proxy' ? 'ready' : 'demo', detail: mode === 'proxy' ? '可信身份代理签名已启用' : '当前使用本地演示身份' },
          { id: 'knowledge', label: '企业知识检索', status: knowledgeUrl ? 'ready' : 'demo', detail: knowledgeUrl ? 'REST Knowledge Adapter 已配置' : '当前使用带 ACL 的演示知识源' },
          { id: 'memory', label: 'Letta 流程记忆', status: process.env.LETTA_AGENT_ID ? 'ready' : 'pending', detail: process.env.LETTA_AGENT_ID ? '服务端 Agent 已配置' : '等待配置租户级 Letta Agent' },
          { id: 'audit', label: '持久化审计', status: 'pending', detail: '当前网关仅验证请求；生产环境需接入 Postgres 或 SIEM' },
        ],
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/knowledge/search') {
      const body = await readJson(request) as { query?: unknown; limit?: unknown }
      if (typeof body.query !== 'string' || !body.query.trim()) {
        send(response, 400, { error: 'query is required' })
        return
      }
      const limit = Math.min(Math.max(typeof body.limit === 'number' ? body.limit : 8, 1), 20)
      const results = await searchKnowledge(identity, body.query.trim(), limit)
      send(response, 200, { results })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/runs/preflight') {
      authorize(identity, 'run:start')
      const body = await readJson(request) as { app?: unknown }
      const app = body.app as AgentApp | undefined
      if (!app || typeof app.id !== 'string' || !Array.isArray(app.capabilities)) {
        send(response, 400, { error: 'A valid app manifest is required' })
        return
      }
      const errors = validateCapabilities(app.capabilities, app.runtime)
      send(response, errors.length ? 422 : 200, {
        allowed: errors.length === 0,
        errors,
        tenantId: identity.tenantId,
        subject: identity.sub,
        checkedAt: new Date().toISOString(),
      })
      return
    }

    send(response, 404, { error: 'route not found' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Enterprise Gateway error'
    const status = message.startsWith('Missing enterprise permission') ? 403 : message.includes('identity') || message.includes('Identity') ? 401 : 502
    send(response, status, { error: message })
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`AWOS Enterprise Gateway listening on http://127.0.0.1:${port} (${mode} auth)`)
})
