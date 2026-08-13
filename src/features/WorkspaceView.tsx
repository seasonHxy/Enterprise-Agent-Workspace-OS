import { AppWindow, ArrowUpRight, Bot, Boxes, Building2, Check, CircleDashed, Database, History, KeyRound, ListChecks, Play, Plus, ScrollText, Settings2, ShieldCheck, TriangleAlert } from 'lucide-react'
import type { AgentApp, AuditEvent } from '../core/types'
import type { EnterpriseStatus } from '../core/enterprise'
import { formatTime } from '../core/format'
import { approvalLabels } from '../core/policy'
import { RiskBadge, RuntimeBadge } from '../components/Primitives'

interface WorkspaceViewProps {
  apps: AgentApp[]
  audits: AuditEvent[]
  onBuild: () => void
  onRun: (app: AgentApp) => void
  onEdit: (app: AgentApp) => void
  startingAppId: string | null
  enterprise: EnterpriseStatus
}

const integrationIcons = {
  identity: KeyRound,
  knowledge: Database,
  memory: History,
  audit: ScrollText,
}

export function WorkspaceView({ apps, audits, enterprise, onBuild, onRun, onEdit, startingAppId }: WorkspaceViewProps) {
  return (
    <div className="workspace-view page view-enter">
      <div className="page-heading"><div><p className="eyebrow">Workspace · Personal Space</p><h1>应用、资源与策略，在一个边界内</h1><p>本地数据默认留在设备上；共享应用只携带代码与权限声明。</p></div><button className="primary-button" onClick={onBuild}><Plus size={16} /> 新建应用</button></div>

      <div className="metric-grid workspace-metrics">
        <div><span className="metric-icon purple"><AppWindow size={19} /></span><span><small>Agent Apps</small><strong>{apps.length}</strong></span></div>
        <div><span className="metric-icon blue"><Boxes size={19} /></span><span><small>集成端点</small><strong>{enterprise.integrations.length}</strong></span></div>
        <div><span className="metric-icon green"><Database size={19} /></span><span><small>知识检索</small><strong>{enterprise.integrations.find((item) => item.id === 'knowledge')?.status === 'ready' ? '在线' : '演示'}</strong></span></div>
        <div><span className="metric-icon amber"><ShieldCheck size={19} /></span><span><small>身份模式</small><strong>{enterprise.integrations.find((item) => item.id === 'identity')?.status === 'ready' ? 'SSO' : 'Demo'}</strong></span></div>
      </div>

      <section className="enterprise-panel" aria-labelledby="enterprise-title">
        <header>
          <span className="enterprise-mark"><Building2 size={20} /></span>
          <span><small>Enterprise Control Plane</small><strong id="enterprise-title">{enterprise.organization.name}</strong></span>
          <span className={`enterprise-health ${enterprise.health}`}>
            {enterprise.health === 'checking' ? <CircleDashed className="spin" size={14} /> : enterprise.health === 'ready' ? <Check size={14} /> : <TriangleAlert size={14} />}
            {enterprise.health === 'checking' ? '正在检查' : enterprise.health === 'ready' ? '企业网关在线' : '本地 / 降级模式'}
          </span>
        </header>
        <div className="enterprise-identity">
          <span><small>当前身份</small><strong>{enterprise.identity.name}</strong><em>{enterprise.identity.email}</em></span>
          <span><small>角色</small><strong>{enterprise.identity.roles.join(' · ')}</strong><em>{enterprise.identity.groups.join(' / ')}</em></span>
        </div>
        <div className="integration-grid">
          {enterprise.integrations.map((integration) => {
            const Icon = integrationIcons[integration.id]
            return <article key={integration.id} className={integration.status}>
              <span><Icon size={16} /></span>
              <div><strong>{integration.label}</strong><small>{integration.detail}</small></div>
              <em>{integration.status === 'ready' ? '已连接' : integration.status === 'demo' ? '演示' : integration.status === 'pending' ? '待配置' : '异常'}</em>
            </article>
          })}
        </div>
      </section>

      <div className="workspace-grid">
        <section className="data-panel apps-panel">
          <header className="panel-header"><div><h2>Agent Apps</h2><p>可运行、可共享、可审计的工作单元</p></div><button className="text-button" onClick={onBuild}>查看全部 <ArrowUpRight size={15} /></button></header>
          <div className="app-card-grid">
            {apps.map((app) => (
              <article className="app-card" key={app.id}>
                <div className="app-card-head"><span className="app-glyph"><Bot size={20} /></span><RuntimeBadge runtime={app.runtime} /></div>
                <h3>{app.name}</h3><p>{app.description}</p>
                <div className="capability-pills">{app.capabilities.length === 0 ? <span>无外部权限</span> : app.capabilities.slice(0, 2).map((capability) => <span key={capability.id}>{capability.label}</span>)}</div>
                {app.workflowSteps?.length ? <span className="app-plan-count"><ListChecks size={13} /> {app.workflowSteps.length} 步标准流程</span> : null}
                <div className="app-version-row"><span><History size={12} /> 工作流 v{app.version ?? 1}</span><button onClick={() => onEdit(app)}><Settings2 size={13} /> 编辑</button></div>
                <div className="app-card-footer"><small>{app.schedule ?? '手动运行'}</small><button aria-label={`运行 ${app.name}`} disabled={startingAppId === app.id} onClick={() => onRun(app)}><Play size={16} /> 运行前预检</button></div>
              </article>
            ))}
          </div>
        </section>

        <aside className="data-panel audit-panel">
          <header className="panel-header"><div><h2>最近审计</h2><p>权限决策不可由 Agent 修改</p></div><ScrollText size={18} /></header>
          <div className="audit-list">
            {audits.slice(0, 5).map((audit) => (
              <div key={audit.id}><span className={`audit-dot ${audit.outcome}`} /><span><strong>{audit.action}</strong><small>{formatTime(audit.timestamp)}</small></span><RiskBadge risk={audit.risk} /></div>
            ))}
          </div>
        </aside>
      </div>

      <section className="security-strip">
        <span className="security-icon"><ShieldCheck size={22} /></span><span><strong>Gatekeeper 保护此工作空间</strong><small>凭证保存在执行边界之外；每个调用都会重新核对资源、作用域和审批策略。</small></span>
        <div className="policy-summary"><span>默认策略</span><strong>{approvalLabels['every-time']}</strong></div>
      </section>
    </div>
  )
}
