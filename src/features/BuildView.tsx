import {
  ArrowLeft,
  ArrowRight,
  Check,
  Cloud,
  Clock3,
  FileCode2,
  GitPullRequest,
  Laptop,
  Newspaper,
  Plus,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { approvalLabels, validateCapabilities } from '../core/policy'
import { capabilityCatalog } from '../core/seed'
import { createAppFromTemplate, workflowTemplates } from '../core/templates'
import type { AgentApp, Capability, RuntimeKind, WorkflowTemplate } from '../core/types'
import { RiskBadge } from '../components/Primitives'

interface BuildViewProps {
  initialPrompt: string
  onCreate: (app: AgentApp) => void
}

export function BuildView({ initialPrompt, onCreate }: BuildViewProps) {
  const [mode, setMode] = useState<'templates' | 'custom'>(initialPrompt ? 'custom' : 'templates')
  const [step, setStep] = useState(1)
  const [name, setName] = useState('行业情报助手')
  const [prompt, setPrompt] = useState(initialPrompt || '每周研究指定行业的产品变化，核对公开来源，并生成一页中文简报。')
  const [runtime, setRuntime] = useState<RuntimeKind>('cloud')
  const [selected, setSelected] = useState<string[]>(['web-research'])
  const selectedCapabilities = capabilityCatalog.filter((capability) => selected.includes(capability.id))
  const errors = useMemo(() => validateCapabilities(selectedCapabilities, runtime), [selectedCapabilities, runtime])

  function createFromTemplate(template: WorkflowTemplate) {
    onCreate(createAppFromTemplate(template))
  }

  function toggleCapability(capability: Capability) {
    setSelected((current) =>
      current.includes(capability.id)
        ? current.filter((id) => id !== capability.id)
        : [...current, capability.id],
    )
  }

  function chooseRuntime(next: RuntimeKind) {
    setRuntime(next)
    if (next === 'cloud') setSelected((current) => current.filter((id) => id !== 'workspace-files'))
  }

  function createApp() {
    if (errors.length > 0 || !name.trim() || !prompt.trim()) return
    onCreate({
      id: `app-${Date.now()}`,
      name: name.trim(),
      description: prompt.trim().slice(0, 64),
      prompt: prompt.trim(),
      runtime,
      status: 'ready',
      capabilities: selectedCapabilities,
      version: 1,
      createdAt: new Date().toISOString(),
    })
  }

  return (
    <div className="build-view page view-enter">
      <div className="page-heading">
        <div><p className="eyebrow">Build · 工作流工坊</p><h1>{mode === 'templates' ? '从验证过的流程开始' : '把一个目标变成安全的 Agent App'}</h1><p>{mode === 'templates' ? '选择适用场景，系统会预设步骤、运行时与最小权限，并按统一策略校验。' : '应用由指令、运行时和最小权限清单构成。'}</p></div>
        {mode === 'custom' ? <div className="stepper" aria-label={`创建应用步骤 ${step} / 3`}>
          {[1, 2, 3].map((value) => <span key={value} className={step >= value ? 'active' : ''}>{step > value ? <Check size={13} /> : value}</span>)}
        </div> : null}
      </div>

      <div className="build-mode segmented" aria-label="创建应用方式">
        <button className={mode === 'templates' ? 'active' : ''} onClick={() => setMode('templates')}><Workflow size={15} /> 场景模板</button>
        <button className={mode === 'custom' ? 'active' : ''} onClick={() => setMode('custom')}><Sparkles size={15} /> 自定义创建</button>
      </div>

      {mode === 'templates' ? (
        <section className="template-library">
          <header><div><h2>可直接运行的工作流</h2><p>模板只预设流程和最小权限，不会预先批准任何敏感操作。</p></div><span>{workflowTemplates.length} 个场景</span></header>
          <div className="template-grid">
            {workflowTemplates.map((template) => {
              const Icon = template.category === 'engineering' ? GitPullRequest : template.category === 'research' ? SearchCheck : template.category === 'operations' ? ShieldCheck : Newspaper
              const templateCapabilities = capabilityCatalog.filter((capability) => template.capabilityIds.includes(capability.id))
              return (
                <article className="template-card" key={template.id}>
                  <div className="template-card-head"><span className={`template-icon ${template.category}`}><Icon size={20} /></span><span className="template-category">{template.category === 'engineering' ? '研发效能' : template.category === 'research' ? '市场研究' : template.category === 'operations' ? '运维复盘' : '内容生产'}</span></div>
                  <h3>{template.name}</h3><p>{template.description}</p>
                  <div className="template-meta"><span><Clock3 size={13} /> {template.schedule ?? '手动运行'}</span><span>{template.runtime === 'local' ? <Laptop size={13} /> : <Cloud size={13} />} {template.runtime === 'local' ? 'Local' : 'Cloud'}</span></div>
                  <ol>{template.steps.map((item) => <li key={item}>{item}</li>)}</ol>
                  <div className="capability-pills">{templateCapabilities.map((capability) => <span key={capability.id}>{capability.label} · {approvalLabels[capability.approval]}</span>)}</div>
                  <footer><span><strong>交付物</strong><small>{template.expectedOutput}</small></span><button className="primary-button" onClick={() => createFromTemplate(template)}>使用模板 <ArrowRight size={15} /></button></footer>
                </article>
              )
            })}
          </div>
          <div className="template-safety"><ShieldCheck size={18} /><span><strong>模板不携带授权</strong><small>每次运行仍会重新执行 Capability 校验、审批与审计。</small></span></div>
        </section>
      ) : null}

      {mode === 'custom' ? <div className="builder-layout">
        <section className="builder-panel">
          {step === 1 ? (
            <div className="form-section">
              <div className="section-heading"><span className="section-icon"><Sparkles size={19} /></span><div><h2>描述目标</h2><p>说明结果和边界，不需要编写工作流。</p></div></div>
              <label htmlFor="app-name">应用名称</label>
              <input id="app-name" value={name} onChange={(event) => setName(event.target.value)} />
              <label htmlFor="app-prompt">这个应用需要完成什么？</label>
              <textarea id="app-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={8} />
              <p className="field-help">建议包含执行频率、数据来源和期望输出。</p>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="form-section">
              <div className="section-heading"><span className="section-icon"><FileCode2 size={19} /></span><div><h2>选择执行面</h2><p>私有上下文留在本机，共享任务放进云沙箱。</p></div></div>
              <div className="runtime-options">
                <button className={runtime === 'local' ? 'selected' : ''} onClick={() => chooseRuntime('local')}>
                  <span className="option-icon"><Laptop size={21} /></span>
                  <span><strong>Local Runner</strong><small>本地文件、Coding Agent 与私有上下文</small></span>
                  <span className="radio-mark">{runtime === 'local' ? <Check size={14} /> : null}</span>
                </button>
                <button className={runtime === 'cloud' ? 'selected' : ''} onClick={() => chooseRuntime('cloud')}>
                  <span className="option-icon"><Cloud size={21} /></span>
                  <span><strong>Cloud Sandbox</strong><small>隔离运行、定时任务与团队共享</small></span>
                  <span className="radio-mark">{runtime === 'cloud' ? <Check size={14} /> : null}</span>
                </button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="form-section">
              <div className="section-heading"><span className="section-icon"><ShieldCheck size={19} /></span><div><h2>授予最小权限</h2><p>应用只能使用清单中的资源，凭证不会进入模型上下文。</p></div></div>
              <div className="capability-list">
                {capabilityCatalog.map((capability) => {
                  const active = selected.includes(capability.id)
                  const incompatible = runtime === 'cloud' && capability.resource === 'local-files'
                  return (
                    <button
                      key={capability.id}
                      className={`${active ? 'selected' : ''} ${incompatible ? 'incompatible' : ''}`}
                      disabled={incompatible}
                      onClick={() => toggleCapability(capability)}
                    >
                      <span className="capability-check">{active ? <Check size={14} /> : <Plus size={14} />}</span>
                      <span className="capability-copy"><strong>{capability.label}</strong><small>{capability.description}</small><code>{capability.scope}</code></span>
                      <span className="capability-policy"><RiskBadge risk={capability.risk} /><small>{approvalLabels[capability.approval]}</small></span>
                    </button>
                  )
                })}
              </div>
              {errors.length > 0 ? <div className="inline-error" role="alert"><X size={16} />{errors[0]}</div> : null}
            </div>
          ) : null}

          <footer className="builder-footer">
            <button className="ghost-button" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))}><ArrowLeft size={16} /> 上一步</button>
            {step < 3 ? (
              <button className="primary-button" disabled={step === 1 && (!name.trim() || !prompt.trim())} onClick={() => setStep((current) => current + 1)}>继续 <ArrowRight size={16} /></button>
            ) : (
              <button className="primary-button" disabled={errors.length > 0} onClick={createApp}><Sparkles size={16} /> 创建应用</button>
            )}
          </footer>
        </section>

        <aside className="manifest-preview">
          <div className="manifest-head"><span><span className="code-dot red" /><span className="code-dot amber" /><span className="code-dot green" /></span><code>agent-app.yaml</code></div>
          <pre>{`name: ${name || 'untitled-app'}
runtime: ${runtime}-sandbox

capabilities:${selectedCapabilities.length ? selectedCapabilities.map((capability) => `\n  - ${capability.resource}.${capability.mode}:\n      scope: ${capability.scope}\n      approval: ${capability.approval}`).join('') : '\n  []'}

sharing:
  mode: private
  roles: [owner, runner]

secrets:
  expose_to_model: false`}</pre>
          <div className="manifest-note"><ShieldCheck size={16} /><span><strong>策略验证通过后才能运行</strong><small>高风险权限无法被应用自身降级。</small></span></div>
        </aside>
      </div> : null}
    </div>
  )
}
