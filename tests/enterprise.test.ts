import { describe, expect, it } from 'vitest'
import {
  authorize,
  canReadKnowledgeDocument,
  createDemoIdentity,
  matchesKnowledgeQuery,
  signIdentityAssertion,
  verifyIdentityAssertion,
  type EnterpriseKnowledgeDocument,
} from '../server/enterprise-core'

describe('enterprise trust boundary', () => {
  const secret = 'test-secret-that-is-longer-than-32-characters'
  const now = 1_786_590_000

  it('accepts a valid short-lived signed identity assertion', () => {
    const identity = createDemoIdentity('tenant-a', now)
    const signed = signIdentityAssertion(identity, secret)
    expect(verifyIdentityAssertion(signed.assertion, signed.signature, secret, now)).toEqual(identity)
  })

  it('rejects tampered and expired identity assertions', () => {
    const signed = signIdentityAssertion(createDemoIdentity('tenant-a', now), secret)
    expect(() => verifyIdentityAssertion(`${signed.assertion}x`, signed.signature, secret, now)).toThrow('signature')
    expect(() => verifyIdentityAssertion(signed.assertion, signed.signature, secret, now + 3_601)).toThrow('expired')
  })

  it('enforces role permissions on the server', () => {
    const member = { ...createDemoIdentity('tenant-a', now), roles: ['member' as const] }
    expect(() => authorize(member, 'run:start')).not.toThrow()
    expect(() => authorize(member, 'workflow:write')).toThrow('Missing enterprise permission')
  })

  it('filters knowledge by tenant and group ACL', () => {
    const identity = createDemoIdentity('tenant-a', now)
    const visible: EnterpriseKnowledgeDocument = {
      id: 'visible', title: 'Visible', excerpt: '', source: 'test', tenantId: 'tenant-a',
      allowedGroups: ['product'], updatedAt: new Date(now * 1000).toISOString(),
    }
    const wrongGroup = { ...visible, id: 'wrong-group', allowedGroups: ['finance'] }
    const wrongTenant = { ...visible, id: 'wrong-tenant', tenantId: 'tenant-b' }
    expect(canReadKnowledgeDocument(identity, visible)).toBe(true)
    expect(canReadKnowledgeDocument(identity, wrongGroup)).toBe(false)
    expect(canReadKnowledgeDocument(identity, wrongTenant)).toBe(false)
    expect(matchesKnowledgeQuery(visible, '请基于企业知识生成一份 Visible 客户方案')).toBe(true)
    expect(matchesKnowledgeQuery(wrongGroup, '完全无关的天气预报')).toBe(false)
  })
})
