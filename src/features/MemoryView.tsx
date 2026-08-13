import {
  BrainCircuit,
  CheckCircle2,
  CloudCog,
  Database,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Workflow,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatTime } from '../core/format'
import type { MemoryStatus, WorkflowMemory } from '../core/types'
import { EmptyState, RuntimeBadge } from '../components/Primitives'

interface MemoryViewProps {
  memories: WorkflowMemory[]
  status: MemoryStatus
  loading: boolean
  onRefresh: () => void
  onForget: (memory: WorkflowMemory) => void
}

export function MemoryView({ memories, status, loading, onRefresh, onForget }: MemoryViewProps) {
  const [query, setQuery] = useState('')
  const visibleMemories = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return memories
    return memories.filter((memory) => [
      memory.title,
      memory.summary,
      memory.goal,
      ...memory.tags,
    ].join(' ').toLowerCase().includes(normalized))
  }, [memories, query])
  const totalRuns = memories.reduce((sum, memory) => sum + memory.runCount, 0)
  const successRuns = memories.reduce((sum, memory) => sum + memory.successCount, 0)
  const successRate = totalRuns === 0 ? 0 : Math.round((successRuns / totalRuns) * 100)

  function confirmForget(memory: WorkflowMemory) {
    if (window.confirm(`确定忘记「${memory.title}」吗？此操作会同时尝试删除 Letta 中对应的 Passage。`)) {
      onForget(memory)
    }
  }

  return (
    <div className="memory-view page view-enter">
      <div className="page-heading">
        <div><p className="eyebrow">Memory · 流程记忆</p><h1>让相似工作从经验开始，而不是从零开始</h1><p>任务运行前检索相似流程，完成后沉淀步骤、结果与权限边界；Letta 负责长期语义记忆，AWOS 仍负责授权和执行。</p></div>
        <button className="secondary-button" disabled={loading} onClick={onRefresh}><RefreshCw className={loading ? 'spin' : ''} size={16} /> {loading ? '同步中' : '同步记忆'}</button>
      </div>

      <section className={`memory-status ${status.health}`} aria-live="polite">
        <span className="memory-status-icon">{status.provider === 'letta' ? <CloudCog size={21} /> : <Database size={21} />}</span>
        <span><strong>{status.label}</strong><small>{status.detail}</small></span>
        <span className="provider-pill">{status.provider === 'letta' ? 'LETTA' : 'LOCAL'}</span>
      </section>

      <div className="metric-grid memory-metrics">
        <div><span className="metric-icon purple"><BrainCircuit size={19} /></span><span><small>可复用流程</small><strong>{memories.length}</strong></span></div>
        <div><span className="metric-icon blue"><Workflow size={19} /></span><span><small>累计运行</small><strong>{totalRuns}</strong></span></div>
        <div><span className="metric-icon green"><CheckCircle2 size={19} /></span><span><small>成功率</small><strong>{successRate}%</strong></span></div>
        <div><span className="metric-icon amber"><ShieldCheck size={19} /></span><span><small>权限仍需审批</small><strong>100%</strong></span></div>
      </div>

      <div className="memory-layout">
        <section className="data-panel memory-library">
          <header className="panel-header">
            <div><h2>流程记忆库</h2><p>展示来源、复用次数和可解释步骤</p></div>
            <label className="memory-search"><span className="sr-only">搜索流程记忆</span><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索目标或标签" /></label>
          </header>
          <div className="memory-list">
            {loading && memories.length === 0 ? <div className="memory-skeleton" aria-label="正在加载记忆" /> : null}
            {!loading && visibleMemories.length === 0 ? <EmptyState title="没有匹配的流程" body="完成一次任务后，系统会在这里保存可复用经验。" /> : null}
            {visibleMemories.map((memory) => (
              <article className="memory-card" key={memory.id}>
                <div className="memory-card-head">
                  <span className="memory-glyph"><Workflow size={18} /></span>
                  <span><strong>{memory.title}</strong><small>{memory.summary}</small></span>
                  <RuntimeBadge runtime={memory.runtime} />
                </div>
                <div className="memory-tags">{memory.tags.slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}</div>
                <ol className="memory-steps">{memory.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                <footer><span>{memory.provider === 'letta' ? 'Letta Passage' : 'Local mirror'} · 已复用 {memory.runCount} 次 · 成功 {memory.successCount} 次 · {formatTime(memory.lastUsedAt)}</span><button className="icon-button danger" aria-label={`忘记 ${memory.title}`} onClick={() => confirmForget(memory)}><Trash2 size={16} /></button></footer>
              </article>
            ))}
          </div>
        </section>

        <aside className="memory-principles">
          <div className="data-panel">
            <header className="panel-header"><div><h2>一次完整闭环</h2><p>检索不等于授权</p></div><BrainCircuit size={18} /></header>
            <ol>
              <li><span>1</span><div><strong>Recall</strong><small>Letta 语义搜索召回相似工作。</small></div></li>
              <li><span>2</span><div><strong>Rank</strong><small>运行时、Capability 与流程指纹二次排序。</small></div></li>
              <li><span>3</span><div><strong>Gate</strong><small>Gatekeeper 重新检查本次真实权限。</small></div></li>
              <li><span>4</span><div><strong>Reflect</strong><small>完成后更新步骤、结果和复用次数。</small></div></li>
            </ol>
          </div>
          <div className="memory-boundary"><ShieldCheck size={19} /><span><strong>安全边界没有改变</strong><small>Letta 只能提供上下文和候选步骤，不能批准工具、读取 OAuth Token 或绕过 L0–L4 策略。</small></span></div>
        </aside>
      </div>
    </div>
  )
}
