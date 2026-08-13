import { Check, Cloud, History, Laptop, Plus, RotateCcw, Save, ShieldCheck, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { approvalLabels, validateCapabilities } from '../core/policy'
import { capabilityCatalog } from '../core/seed'
import { getWorkflowHistory } from '../core/workflow'
import type { AgentApp, Capability, RuntimeKind, WorkflowUpdate } from '../core/types'
import { RiskBadge } from '../components/Primitives'

interface WorkflowEditorProps {
  app: AgentApp
  onClose: () => void
  onSave: (update: WorkflowUpdate) => void
  onRestore: (versionId: string) => void
}

export function WorkflowEditor({ app, onClose, onSave, onRestore }: WorkflowEditorProps) {
  const [name, setName] = useState(app.name)
  const [description, setDescription] = useState(app.description)
  const [prompt, setPrompt] = useState(app.prompt)
  const [runtime, setRuntime] = useState<RuntimeKind>(app.runtime)
  const [selected, setSelected] = useState(app.capabilities.map((capability) => capability.id))
  const [steps, setSteps] = useState(app.workflowSteps?.length ? [...app.workflowSteps] : ['理解目标', '执行任务', '检查结果'])
  const [schedule, setSchedule] = useState(app.schedule ?? '')
  const [changeNote, setChangeNote] = useState('')
  const [tab, setTab] = useState<'edit' | 'history'>('edit')
  const selectedCapabilities = capabilityCatalog.filter((capability) => selected.includes(capability.id))
  const errors = useMemo(() => validateCapabilities(selectedCapabilities, runtime), [selectedCapabilities, runtime])
  const history = getWorkflowHistory(app).slice().reverse()
  const valid = name.trim() && description.trim() && prompt.trim() && steps.filter((step) => step.trim()).length >= 2 && errors.length === 0

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  function chooseRuntime(next: RuntimeKind) {
    setRuntime(next)
    if (next === 'cloud') setSelected((current) => current.filter((id) => id !== 'workspace-files'))
  }

  function toggleCapability(capability: Capability) {
    setSelected((current) => current.includes(capability.id)
      ? current.filter((id) => id !== capability.id)
      : [...current, capability.id])
  }

  function updateStep(index: number, value: string) {
    setSteps((current) => current.map((step, stepIndex) => stepIndex === index ? value : step))
  }

  function submit() {
    if (!valid) return
    onSave({
      name,
      description,
      prompt,
      runtime,
      capabilityIds: selected,
      workflowSteps: steps,
      schedule,
      changeNote,
    })
  }

  return (
    <div className="editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
      <section className="workflow-editor" role="dialog" aria-modal="true" aria-labelledby="workflow-editor-title">
        <header className="editor-header">
          <div><p className="eyebrow">Workflow Studio</p><h2 id="workflow-editor-title">编辑 {app.name}</h2><p>保存会创建新版本，历史运行仍保留原始快照。</p></div>
          <button className="icon-button" aria-label="关闭工作流编辑器" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="editor-tabs segmented" role="tablist" aria-label="工作流编辑器视图">
          <button role="tab" aria-selected={tab === 'edit'} className={tab === 'edit' ? 'active' : ''} onClick={() => setTab('edit')}><Save size={15} /> 编辑 v{app.version ?? 1}</button>
          <button role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><History size={15} /> 版本历史</button>
        </div>

        {tab === 'edit' ? <div className="editor-body">
          <div className="editor-form">
            <fieldset><legend>01 · 基本信息</legend>
              <label htmlFor="workflow-name">工作流名称</label><input autoFocus id="workflow-name" value={name} onChange={(event) => setName(event.target.value)} />
              <label htmlFor="workflow-description">用途说明</label><input id="workflow-description" value={description} onChange={(event) => setDescription(event.target.value)} />
              <label htmlFor="workflow-prompt">执行目标</label><textarea id="workflow-prompt" rows={4} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            </fieldset>
            <fieldset><legend>02 · 执行面</legend>
              <div className="editor-runtime">
                <button className={runtime === 'local' ? 'selected' : ''} onClick={() => chooseRuntime('local')}><Laptop size={18} /><span><strong>Local Runner</strong><small>本地私有上下文</small></span>{runtime === 'local' ? <Check size={15} /> : null}</button>
                <button className={runtime === 'cloud' ? 'selected' : ''} onClick={() => chooseRuntime('cloud')}><Cloud size={18} /><span><strong>Cloud Sandbox</strong><small>隔离与定时运行</small></span>{runtime === 'cloud' ? <Check size={15} /> : null}</button>
              </div>
              <label htmlFor="workflow-schedule">运行计划（可选）</label><input id="workflow-schedule" value={schedule} onChange={(event) => setSchedule(event.target.value)} placeholder="例如：每周一 09:00" />
            </fieldset>
            <fieldset><legend>03 · 标准步骤</legend>
              <div className="step-editor">
                {steps.map((step, index) => <div key={`${index}-${steps.length}`}><span>{String(index + 1).padStart(2, '0')}</span><input aria-label={`第 ${index + 1} 个步骤`} value={step} onChange={(event) => updateStep(index, event.target.value)} /><button aria-label={`删除第 ${index + 1} 个步骤`} disabled={steps.length <= 2} onClick={() => setSteps((current) => current.filter((_, stepIndex) => stepIndex !== index))}><Trash2 size={15} /></button></div>)}
                <button className="add-step" onClick={() => setSteps((current) => [...current, ''])}><Plus size={15} /> 添加步骤</button>
              </div>
            </fieldset>
            <fieldset><legend>04 · 最小权限</legend>
              <div className="editor-capabilities">
                {capabilityCatalog.map((capability) => {
                  const active = selected.includes(capability.id)
                  const incompatible = runtime === 'cloud' && capability.resource === 'local-files'
                  return <button key={capability.id} className={active ? 'selected' : ''} disabled={incompatible} onClick={() => toggleCapability(capability)}><span className="capability-check">{active ? <Check size={14} /> : <Plus size={14} />}</span><span><strong>{capability.label}</strong><small>{approvalLabels[capability.approval]}</small></span><RiskBadge risk={capability.risk} /></button>
                })}
              </div>
              {errors.length ? <p className="editor-error" role="alert"><X size={15} /> {errors[0]}</p> : <p className="editor-safe"><ShieldCheck size={15} /> 运行前还会重新校验，不会继承历史授权。</p>}
            </fieldset>
          </div>
          <aside className="version-summary"><span>即将创建</span><strong>v{(app.version ?? 1) + 1}</strong><small>{steps.filter((step) => step.trim()).length} 个步骤 · {selectedCapabilities.length} 项权限</small><label htmlFor="change-note">版本说明</label><textarea id="change-note" rows={4} value={changeNote} onChange={(event) => setChangeNote(event.target.value)} placeholder="例如：增加测试失败时的停止条件" /></aside>
        </div> : null}

        {tab === 'history' ? <div className="version-history">
          {history.map((version, index) => <article key={version.id} className={index === 0 ? 'current' : ''}><span className="version-number">v{version.version}</span><div><strong>{version.changeNote}</strong><small>{version.workflowSteps.length} 个步骤 · {version.runtime === 'local' ? 'Local Runner' : 'Cloud Sandbox'} · {new Date(version.createdAt).toLocaleString('zh-CN')}</small><p>{version.workflowSteps.join(' → ')}</p></div>{index === 0 ? <span className="current-label">当前版本</span> : <button className="secondary-button" onClick={() => onRestore(version.id)}><RotateCcw size={14} /> 恢复为新版本</button>}</article>)}
        </div> : null}

        <footer className="editor-footer"><button className="ghost-button" onClick={onClose}>取消</button>{tab === 'edit' ? <button className="primary-button" disabled={!valid} onClick={submit}><Save size={16} /> 保存为 v{(app.version ?? 1) + 1}</button> : null}</footer>
      </section>
    </div>
  )
}
