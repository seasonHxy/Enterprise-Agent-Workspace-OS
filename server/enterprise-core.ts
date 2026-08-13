import { createHmac, timingSafeEqual } from 'node:crypto'

export type EnterpriseRole = 'member' | 'builder' | 'approver' | 'admin'

export type EnterprisePermission =
  | 'knowledge:read'
  | 'run:start'
  | 'workflow:write'
  | 'approval:grant'
  | 'audit:read'

export interface EnterpriseIdentity {
  sub: string
  email: string
  name: string
  tenantId: string
  roles: EnterpriseRole[]
  groups: string[]
  iat: number
  exp: number
}

export interface EnterpriseKnowledgeDocument {
  id: string
  title: string
  excerpt: string
  source: string
  url?: string
  tenantId: string
  allowedGroups: string[]
  updatedAt: string
}

const rolePermissions: Record<EnterpriseRole, EnterprisePermission[]> = {
  member: ['knowledge:read', 'run:start'],
  builder: ['knowledge:read', 'run:start', 'workflow:write'],
  approver: ['knowledge:read', 'run:start', 'approval:grant', 'audit:read'],
  admin: ['knowledge:read', 'run:start', 'workflow:write', 'approval:grant', 'audit:read'],
}

const knownRoles = new Set<EnterpriseRole>(['member', 'builder', 'approver', 'admin'])

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function parseIdentity(value: unknown): EnterpriseIdentity {
  if (!value || typeof value !== 'object') throw new Error('Identity assertion is invalid')
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.sub !== 'string'
    || typeof candidate.email !== 'string'
    || typeof candidate.name !== 'string'
    || typeof candidate.tenantId !== 'string'
    || typeof candidate.iat !== 'number'
    || typeof candidate.exp !== 'number'
    || !isStringArray(candidate.roles)
    || !candidate.roles.every((role) => knownRoles.has(role as EnterpriseRole))
    || !isStringArray(candidate.groups)
  ) throw new Error('Identity assertion is incomplete')

  return candidate as unknown as EnterpriseIdentity
}

export function signIdentityAssertion(identity: EnterpriseIdentity, secret: string): { assertion: string; signature: string } {
  const assertion = Buffer.from(JSON.stringify(identity), 'utf8').toString('base64url')
  const signature = createHmac('sha256', secret).update(assertion).digest('base64url')
  return { assertion, signature }
}

export function verifyIdentityAssertion(
  assertion: string | undefined,
  signature: string | undefined,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): EnterpriseIdentity {
  if (!assertion || !signature) throw new Error('Enterprise identity headers are required')
  const expected = createHmac('sha256', secret).update(assertion).digest()
  const received = Buffer.from(signature, 'base64url')
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new Error('Enterprise identity signature is invalid')
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(Buffer.from(assertion, 'base64url').toString('utf8')) as unknown
  } catch {
    throw new Error('Enterprise identity payload is invalid')
  }
  const identity = parseIdentity(decoded)
  if (identity.exp <= now) throw new Error('Enterprise identity assertion has expired')
  if (identity.iat > now + 60) throw new Error('Enterprise identity assertion is not active')
  return identity
}

export function authorize(identity: EnterpriseIdentity, permission: EnterprisePermission): void {
  const allowed = identity.roles.some((role) => rolePermissions[role].includes(permission))
  if (!allowed) throw new Error(`Missing enterprise permission: ${permission}`)
}

export function canReadKnowledgeDocument(
  identity: EnterpriseIdentity,
  document: EnterpriseKnowledgeDocument,
): boolean {
  if (identity.tenantId !== document.tenantId) return false
  if (document.allowedGroups.length === 0) return true
  return document.allowedGroups.some((group) => identity.groups.includes(group))
}

export function knowledgeQueryTerms(query: string): string[] {
  const normalized = query.toLocaleLowerCase()
  const words = normalized.match(/[a-z0-9][a-z0-9_-]{1,}|[\p{Script=Han}]{2,}/gu) ?? []
  const terms = words.flatMap((word) => {
    if (!/^[\p{Script=Han}]+$/u.test(word) || word.length <= 2) return [word]
    return [word, ...Array.from({ length: word.length - 1 }, (_, index) => word.slice(index, index + 2))]
  })
  return [...new Set(terms.filter((term) => term.length >= 2))]
}

export function matchesKnowledgeQuery(document: EnterpriseKnowledgeDocument, query: string): boolean {
  const terms = knowledgeQueryTerms(query)
  if (terms.length === 0) return true
  const haystack = `${document.title} ${document.excerpt} ${document.source}`.toLocaleLowerCase()
  return terms.some((term) => haystack.includes(term))
}

export function createDemoIdentity(tenantId: string, now = Math.floor(Date.now() / 1000)): EnterpriseIdentity {
  return {
    sub: 'demo-user-001',
    email: 'wesson@example.com',
    name: 'Wesson',
    tenantId,
    roles: ['member', 'builder', 'approver'],
    groups: ['all-employees', 'product', 'sales'],
    iat: now,
    exp: now + 3_600,
  }
}
