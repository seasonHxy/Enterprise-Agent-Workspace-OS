import { Activity, BookOpen, BrainCircuit, Check, CheckCircle2, CircleDashed, Clock3, Filter, ListChecks, Play, ShieldAlert, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatTime } from '../core/format'
import { approvalLabels } from '../core/policy'
import type { AgentRun } from '../core/types'
import { EmptyState, RiskBadge, RunStatusBadge, RuntimeBadge } from '../components/Primitives'

interface RunViewProps {
  runs: AgentRun[]
  onApprove: (runId: string) => void
  onDeny: (runId: string) => void
  onComplete: (runId: string) => void
}

export function RunView({ runs, onApprove, onDeny, onComplete }: RunViewProps) {
  const [filter, setFilter] = useState<'all' | 'waiting'>('all')
  const visibleRuns = useMemo(() => filter === 'waiting' ? runs.filter((run) => run.status === 'waiting') : runs, [filter, runs])
  const waiting = runs.filter((run) => run.status === 'waiting').length
  const active = runs.filter((run) => run.status === 'running').length
  const completed = runs.filter((run) => run.status === 'completed').length

  return (
    <div className="run-view page view-enter">
      <div className="page-heading"><div><p className="eyebrow">Run · 执行控制台</p><h1>每次运行都有边界，也有记录</h1><p>查看本地与云端任务，处理需要你决策的操作。</p></div></div>
      <div className="metric-grid">
        <div><span className="metric-icon purple"><Activity size={19} /></span><span><small>执行中</small><strong>{active}</strong></span></div>
        <div><span className="metric-icon amber"><ShieldAlert size={19} /></span><span><small>待审批</small><strong>{waiting}</strong></span></div>
        <div><span className="metric-icon green"><Check size={19} /></span><span><small>已完成</small><strong>{completed}</strong></span></div>
        <div><span className="metric-icon blue"><Clock3 size={19} /></span><span><small>本周运行</small><strong>{runs.length + 12}</strong></span></div>
      </div>

      <section className="data-panel">
        <header className="panel-header"><div><h2>运行记录</h2><p>本地和云端的统一事件流</p></div><div className="segmented"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>全部</button><button className={filter === 'waiting' ? 'active' : ''} onClick={() => setFilter('waiting')}><Filter size={14} /> 待审批</button></div></header>
        <div className="run-list">
          {visibleRuns.length === 0 ? <EmptyState title="没有待审批任务" body="需要决策的操作会集中出现在这里。" /> : visibleRuns.map((run) => (
            <article className={`run-row ${run.status === 'waiting' ? 'attention' : ''}`} key={run.id}>
              <div className="run-primary"><span className="run-app-icon"><Play size={17} /></span><span><strong>{run.appName}{run.workflowVersion ? <em className="run-version">v{run.workflowVersion}</em> : null}</strong><small>{run.summary}</small></span></div>
              <RuntimeBadge runtime={run.runtime} />
              <div className="progress-cell"><div><span style={{ width: `${run.progress}%` }} /></div><small>{run.progress}%</small></div>
              <RunStatusBadge status={run.status} />
              <time>{formatTime(run.startedAt)}</time>
              {run.status === 'waiting' && run.capability ? (
                <div className="approval-card">
                  <div><span className="approval-shield"><ShieldAlert size={18} /></span><span><strong>请求权限：{run.capability.label}</strong><small>{run.capability.description}</small></span></div>
                  <div className="approval-scope"><code>{run.capability.scope}</code><RiskBadge risk={run.capability.risk} /><span>{approvalLabels[run.capability.approval]}</span></div>
                  <div className="approval-actions"><button className="deny-button" onClick={() => onDeny(run.id)}><X size={16} /> 拒绝</button><button className="approve-button" onClick={() => onApprove(run.id)}><Check size={16} /> 仅本次允许</button></div>
                  {run.pendingCapabilityIds && run.pendingCapabilityIds.length > 1 ? <div className="approval-progress" aria-label={`敏感权限审批进度 ${(run.approvedCapabilityIds?.length ?? 0) + 1} / ${run.pendingCapabilityIds.length}`}><span style={{ width: `${((run.approvedCapabilityIds?.length ?? 0) / run.pendingCapabilityIds.length) * 100}%` }} /><small>逐项审批 {(run.approvedCapabilityIds?.length ?? 0) + 1} / {run.pendingCapabilityIds.length}</small></div> : null}
                </div>
              ) : null}
              {run.workflowMatch ? (
                <div className="workflow-match-card">
                  <span className="memory-glyph"><BrainCircuit size={18} /></span>
                  <div className="workflow-match-copy">
                    <span><strong>找到相似流程：{run.workflowMatch.title}</strong><small>{Math.round(run.workflowMatch.score * 100)}% 匹配 · {run.workflowMatch.provider === 'letta' ? 'Letta 语义记忆' : '本地流程记忆'}</small></span>
                    <div className="signal-pills">{run.workflowMatch.matchedSignals.map((signal) => <span key={signal}>{signal}</span>)}</div>
                    <ol>{run.workflowMatch.steps.slice(0, 4).map((step) => <li key={step}>{step}</li>)}</ol>
                  </div>
                </div>
              ) : null}
              {run.knowledgeSources?.length ? (
                <div className="knowledge-evidence-card">
                  <span className="knowledge-glyph"><BookOpen size={18} /></span>
                  <div>
                    <span><strong>企业知识证据</strong><small>{run.knowledgeSources.length} 条 · 已按当前租户与用户组过滤</small></span>
                    <ul>{run.knowledgeSources.map((source) => <li key={source.id}><span><strong>{source.title}</strong><small>{source.source}</small></span><p>{source.excerpt}</p></li>)}</ul>
                  </div>
                </div>
              ) : null}
              {run.phases?.length ? (
                <div className="run-trace">
                  <div className="run-trace-head"><span><ListChecks size={17} /><strong>运行轨迹</strong></span><small>每个阶段都有明确责任边界</small></div>
                  <ol>{run.phases.map((phase) => (
                    <li className={phase.status} key={phase.id}>
                      <span className="phase-marker">{phase.status === 'completed' ? <Check size={13} /> : phase.status === 'blocked' ? <X size={13} /> : <CircleDashed size={13} />}</span>
                      <span><strong>{phase.label}</strong><small>{phase.detail}</small></span>
                    </li>
                  ))}</ol>
                </div>
              ) : null}
              {run.workflowPlan?.length ? (
                <details className="execution-plan"><summary>查看本次执行计划</summary><ol>{run.workflowPlan.map((item) => <li key={item}>{item}</li>)}</ol></details>
              ) : null}
              {run.status === 'running' ? (
                <div className="run-complete-bar"><span><CheckCircle2 size={17} /><small>确认结果后，系统会将本次步骤写入流程记忆。</small></span><button className="secondary-button" onClick={() => onComplete(run.id)}><Check size={16} /> 完成并沉淀</button></div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
