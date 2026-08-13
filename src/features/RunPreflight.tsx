import { AlertTriangle, Check, CircleDashed, Cloud, Laptop, Play, ShieldCheck, X } from 'lucide-react'
import { useEffect } from 'react'
import { canStartWorkflow, getWorkflowPreflight } from '../core/workflow'
import type { AgentApp, PreflightStatus } from '../core/types'

interface RunPreflightProps {
  app: AgentApp
  starting: boolean
  onClose: () => void
  onEdit: () => void
  onConfirm: () => void
}

const statusIcon: Record<PreflightStatus, typeof Check> = {
  pass: Check,
  approval: ShieldCheck,
  attention: AlertTriangle,
  blocked: X,
}

export function RunPreflight({ app, starting, onClose, onEdit, onConfirm }: RunPreflightProps) {
  const checks = getWorkflowPreflight(app)
  const canStart = canStartWorkflow(app)
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) { if (event.key === 'Escape' && !starting) onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose, starting])
  return <div className="editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !starting) onClose() }}>
    <section className="preflight-dialog" role="dialog" aria-modal="true" aria-labelledby="preflight-title">
      <header className="editor-header"><div><p className="eyebrow">Preflight · 运行前预检</p><h2 id="preflight-title">准备运行 {app.name}</h2><p>先确认本次版本、执行边界和需要你决策的权限。</p></div><button className="icon-button" aria-label="关闭运行前预检" disabled={starting} onClick={onClose}><X size={18} /></button></header>
      <div className="preflight-summary"><span className="preflight-runtime">{app.runtime === 'local' ? <Laptop size={19} /> : <Cloud size={19} />}</span><span><strong>{app.runtime === 'local' ? 'Local Runner' : 'Cloud Sandbox'}</strong><small>工作流 v{app.version ?? 1} · {app.workflowSteps?.length ?? 0} 个标准步骤</small></span><span className="preflight-ready"><Check size={14} /> {canStart ? '可以启动' : '需要修复'}</span></div>
      <div className="preflight-checks">{checks.map((check) => { const Icon = statusIcon[check.status]; return <article key={check.id} className={check.status}><span><Icon size={17} /></span><div><strong>{check.label}</strong><small>{check.detail}</small></div></article> })}</div>
      <details className="preflight-plan"><summary>查看本次执行步骤</summary><ol>{(app.workflowSteps ?? ['根据目标动态规划步骤']).map((step) => <li key={step}>{step}</li>)}</ol></details>
      <footer className="editor-footer"><button className="ghost-button" disabled={starting} onClick={onEdit}>返回编辑</button><button autoFocus className="primary-button" disabled={!canStart || starting} onClick={onConfirm}>{starting ? <CircleDashed className="spin" size={16} /> : <Play size={16} />} {starting ? '正在检索流程记忆' : '确认并开始运行'}</button></footer>
    </section>
  </div>
}
