import {
  captureWorkflow,
  decodeWorkflowMemory,
  encodeWorkflowMemory,
  findSimilarWorkflows,
  fingerprintApp,
  mergeWorkflowMemory,
  workflowQuery,
} from './memory'
import { seedApps } from './seed'
import type {
  AgentApp,
  AgentRun,
  MemoryStatus,
  WorkflowMatch,
  WorkflowMemory,
} from './types'

const MEMORY_STORAGE_KEY = 'awos-workflow-memory-v1'

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface LettaPassage {
  id?: string
  text: string
  tags?: string[]
}

export interface WorkflowMemoryProvider {
  status(): Promise<MemoryStatus>
  list(): Promise<WorkflowMemory[]>
  search(app: AgentApp, limit?: number): Promise<WorkflowMatch[]>
  remember(app: AgentApp, run: AgentRun): Promise<WorkflowMemory>
  forget(memory: WorkflowMemory): Promise<void>
}

export const seedWorkflowMemories: WorkflowMemory[] = [
  {
    id: 'memory-seed-research',
    fingerprint: fingerprintApp(seedApps[0]),
    appId: 'app-research',
    appName: '市场研究助手',
    title: '竞品动态周报 · 稳定流程',
    goal: '研究指定市场的最新动态，核对来源并输出结构化简报。',
    summary: '先按主题聚类，再交叉核对来源，最后只保留可追溯的变化。',
    runtime: 'cloud',
    capabilityIds: ['web-research'],
    capabilityLabels: ['网页研究'],
    steps: ['拆分竞品与时间窗口', '并行收集公开来源', '交叉核对变化', '按影响程度生成周报'],
    tags: ['市场研究', '竞品', '周报', '公开网页', 'cloud'],
    outcome: 'success',
    runCount: 8,
    successCount: 8,
    createdAt: '2026-07-14T03:20:00.000Z',
    lastUsedAt: '2026-08-12T03:20:00.000Z',
    provider: 'local',
  },
  {
    id: 'memory-seed-release',
    fingerprint: fingerprintApp(seedApps[1]),
    appId: 'app-release',
    appName: '版本发布管家',
    title: '版本发布前检查 · 可复用清单',
    goal: '检查工作区变更，运行测试并准备发布说明。',
    summary: '测试通过后生成发布说明，写 GitHub 前保留一次明确审批。',
    runtime: 'local',
    capabilityIds: ['workspace-files', 'github-write'],
    capabilityLabels: ['工作区文件', 'GitHub 写入'],
    steps: ['读取变更范围', '运行质量检查', '整理发布说明', '审批后创建 Pull Request'],
    tags: ['版本发布', '测试', 'github', 'pull-request', 'local'],
    outcome: 'success',
    runCount: 5,
    successCount: 4,
    createdAt: '2026-07-28T08:05:00.000Z',
    lastUsedAt: '2026-08-10T08:05:00.000Z',
    provider: 'local',
  },
]

export class LocalWorkflowMemoryProvider implements WorkflowMemoryProvider {
  constructor(private readonly storage: StorageLike) {}

  private read(): WorkflowMemory[] {
    try {
      const raw = this.storage.getItem(MEMORY_STORAGE_KEY)
      if (!raw) {
        this.write(seedWorkflowMemories)
        return seedWorkflowMemories
      }
      const parsed = JSON.parse(raw) as WorkflowMemory[]
      return Array.isArray(parsed) ? parsed : seedWorkflowMemories
    } catch {
      return seedWorkflowMemories
    }
  }

  private write(memories: WorkflowMemory[]) {
    this.storage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories))
  }

  async status(): Promise<MemoryStatus> {
    return {
      provider: 'local',
      health: 'ready',
      label: '本地流程记忆',
      detail: '记忆保存在当前浏览器；可配置 Letta Bridge 获得语义检索与跨会话状态。',
    }
  }

  async list(): Promise<WorkflowMemory[]> {
    return this.read()
  }

  async search(app: AgentApp, limit = 3): Promise<WorkflowMatch[]> {
    return findSimilarWorkflows(app, this.read(), limit)
  }

  async remember(app: AgentApp, run: AgentRun): Promise<WorkflowMemory> {
    const incoming = captureWorkflow(app, run, 'local')
    const memories = mergeWorkflowMemory(this.read(), incoming)
    this.write(memories)
    return memories[0]
  }

  async forget(memory: WorkflowMemory): Promise<void> {
    this.write(this.read().filter((item) => item.id !== memory.id))
  }

  mirror(memory: WorkflowMemory): WorkflowMemory {
    const memories = mergeWorkflowMemory(this.read(), memory)
    this.write(memories)
    return memories[0]
  }
}

export class LettaWorkflowMemoryProvider implements WorkflowMemoryProvider {
  constructor(
    private readonly apiUrl: string,
    private readonly fallback: LocalWorkflowMemoryProvider,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.apiUrl}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
    })
    if (!response.ok) {
      const message = await response.text()
      throw new Error(message || `Letta Bridge 返回 ${response.status}`)
    }
    return response.json() as Promise<T>
  }

  private decodePassages(passages: LettaPassage[]): WorkflowMemory[] {
    return passages.flatMap((passage) => {
      const memory = decodeWorkflowMemory(passage.text)
      return memory ? [{ ...memory, passageId: passage.id, provider: 'letta' as const }] : []
    })
  }

  async status(): Promise<MemoryStatus> {
    try {
      const result = await this.request<{ agentName?: string }>('/api/memory/status')
      return {
        provider: 'letta',
        health: 'ready',
        label: 'Letta 长期记忆在线',
        detail: `${result.agentName ?? 'AWOS Memory Agent'} 正在提供跨会话流程检索。`,
      }
    } catch {
      return {
        provider: 'letta',
        health: 'degraded',
        label: 'Letta 不可达，已安全降级',
        detail: '当前继续使用本地镜像；Bridge 恢复后可重新进行语义检索。',
      }
    }
  }

  async list(): Promise<WorkflowMemory[]> {
    try {
      const passages = await this.request<LettaPassage[]>('/api/memory?limit=100')
      const remote = this.decodePassages(passages)
      return remote.length > 0 ? remote : this.fallback.list()
    } catch {
      return this.fallback.list()
    }
  }

  async search(app: AgentApp, limit = 3): Promise<WorkflowMatch[]> {
    try {
      const query = encodeURIComponent(workflowQuery(app))
      const passages = await this.request<LettaPassage[]>(`/api/memory?query=${query}&limit=12`)
      const remote = this.decodePassages(passages)
      if (remote.length > 0) return findSimilarWorkflows(app, remote, limit)
    } catch {
      // The local mirror is the deliberate fail-safe path.
    }
    return this.fallback.search(app, limit)
  }

  async remember(app: AgentApp, run: AgentRun): Promise<WorkflowMemory> {
    const memory = captureWorkflow(app, run, 'letta')
    try {
      const passage = await this.request<LettaPassage>('/api/memory', {
        method: 'POST',
        body: JSON.stringify({
          text: encodeWorkflowMemory(memory),
          tags: ['awos', 'workflow-v1', ...memory.tags],
        }),
      })
      return this.fallback.mirror({ ...memory, passageId: passage.id })
    } catch {
      return this.fallback.remember(app, run)
    }
  }

  async forget(memory: WorkflowMemory): Promise<void> {
    if (memory.passageId) {
      try {
        await this.request(`/api/memory/${encodeURIComponent(memory.passageId)}`, { method: 'DELETE' })
      } catch {
        // Removing the local mirror still gives the user immediate control.
      }
    }
    await this.fallback.forget(memory)
  }
}

export function createMemoryProvider(): WorkflowMemoryProvider {
  const local = new LocalWorkflowMemoryProvider(window.localStorage)
  const configuredUrl = import.meta.env.VITE_MEMORY_API_URL?.trim()
  if (!configuredUrl) return local
  return new LettaWorkflowMemoryProvider(configuredUrl.replace(/\/$/, ''), local)
}
