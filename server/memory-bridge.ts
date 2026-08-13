import { Letta } from '@letta-ai/letta-client'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

const port = Number(process.env.MEMORY_BRIDGE_PORT ?? 8787)
const agentId = process.env.LETTA_AGENT_ID?.trim()
const allowedOrigin = process.env.AWOS_ORIGIN ?? 'http://localhost:4173'
const tenantId = process.env.AWOS_TENANT_ID?.trim() || 'tenant-demo'
const tenantTag = `tenant:${tenantId}`

if (!agentId) {
  throw new Error('LETTA_AGENT_ID is required. Create a Letta agent and place its id in .env.')
}

const client = new Letta({
  apiKey: process.env.LETTA_API_KEY ?? null,
  baseURL: process.env.LETTA_BASE_URL || undefined,
  environment: process.env.LETTA_BASE_URL ? undefined : 'cloud',
  maxRetries: 1,
  timeout: 15_000,
})

function applyCors(response: ServerResponse) {
  response.setHeader('access-control-allow-origin', allowedOrigin)
  response.setHeader('access-control-allow-methods', 'GET,POST,DELETE,OPTIONS')
  response.setHeader('access-control-allow-headers', 'content-type')
  response.setHeader('vary', 'Origin')
}

function send(response: ServerResponse, status: number, data?: unknown) {
  applyCors(response)
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(data === undefined ? undefined : JSON.stringify(data))
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk)
    size += buffer.length
    if (size > 256_000) throw new Error('Request body exceeds 256 KB')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

interface CreateMemoryBody {
  text?: unknown
  tags?: unknown
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

    if (request.method === 'GET' && url.pathname === '/api/memory/status') {
      const [health, agent] = await Promise.all([client.health(), client.agents.retrieve(agentId)])
      send(response, 200, { status: health.status, version: health.version, agentName: agent.name })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/memory') {
      const query = url.searchParams.get('query')?.trim()
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), 100)
      if (query) {
        const result = await client.agents.passages.search(agentId, {
          query,
          top_k: limit,
          tags: ['awos', 'workflow-v1', tenantTag],
          tag_match_mode: 'all',
        })
        send(response, 200, result.results.map((item) => ({
          id: item.id,
          text: item.content,
          tags: item.tags,
        })))
        return
      }
      const passages = await client.agents.passages.list(agentId, { limit: Math.min(limit * 3, 300), ascending: false })
      send(response, 200, passages.filter((passage) => passage.tags?.includes(tenantTag)).slice(0, limit).map((passage) => ({
        id: passage.id,
        text: passage.text,
        tags: passage.tags,
      })))
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/memory') {
      const body = await readBody(request) as CreateMemoryBody
      if (typeof body.text !== 'string' || body.text.length === 0) {
        send(response, 400, { error: 'text is required' })
        return
      }
      const tags = Array.isArray(body.tags)
        ? body.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 20)
        : []
      const scopedTags = [...new Set(['awos', 'workflow-v1', tenantTag, ...tags.filter((tag) => !tag.startsWith('tenant:'))])]
      const passages = await client.agents.passages.create(agentId, { text: body.text, tags: scopedTags })
      const passage = passages[0]
      send(response, 201, { id: passage?.id, text: passage?.text ?? body.text, tags: passage?.tags ?? scopedTags })
      return
    }

    if (request.method === 'DELETE' && url.pathname.startsWith('/api/memory/')) {
      const memoryId = decodeURIComponent(url.pathname.slice('/api/memory/'.length))
      if (!memoryId.startsWith('passage-')) {
        send(response, 400, { error: 'invalid passage id' })
        return
      }
      const owned = await client.agents.passages.list(agentId, { limit: 300, ascending: false })
      const target = owned.find((passage) => passage.id === memoryId && passage.tags?.includes(tenantTag))
      if (!target) {
        send(response, 404, { error: 'tenant-scoped passage not found' })
        return
      }
      await client.agents.passages.delete(memoryId, { agent_id: agentId })
      send(response, 204)
      return
    }

    send(response, 404, { error: 'route not found' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Letta Bridge error'
    send(response, 502, { error: message })
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`AWOS Letta Memory Bridge listening on http://127.0.0.1:${port}`)
})
