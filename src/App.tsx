import { useCallback, useEffect, useMemo, useState } from 'react'
import { Shell } from './components/Shell'
import { createMemoryProvider } from './core/memory-provider'
import { advanceRunApproval, finishRunPhases, getRuntime } from './core/runtime'
import { capabilityCatalog, seedWorkspace } from './core/seed'
import { loadWorkspace, saveWorkspace } from './core/storage'
import type { AgentApp, AgentRun, AuditEvent, MemoryStatus, View, WorkflowMemory, WorkflowUpdate, WorkspaceState } from './core/types'
import { AskView } from './features/AskView'
import { BuildView } from './features/BuildView'
import { MemoryView } from './features/MemoryView'
import { RunView } from './features/RunView'
import { WorkspaceView } from './features/WorkspaceView'
import { WorkflowEditor } from './features/WorkflowEditor'
import { RunPreflight } from './features/RunPreflight'
import { restoreAgentWorkflow, updateAgentWorkflow } from './core/workflow'
import { createEnterpriseGateway, degradedEnterpriseStatus, localEnterpriseStatus } from './core/enterprise'
import type { EnterpriseStatus } from './core/enterprise'

function createAudit(runId: string, outcome: AuditEvent['outcome'], action: string, risk: AuditEvent['risk']): AuditEvent {
  return {
    id: `audit-${Date.now()}`,
    runId,
    action,
    outcome,
    risk,
    timestamp: new Date().toISOString(),
  }
}

export default function App() {
  const [view, setView] = useState<View>('ask')
  const [buildPrompt, setBuildPrompt] = useState('')
  const [state, setState] = useState<WorkspaceState>(() => loadWorkspace(seedWorkspace))
  const memoryProvider = useMemo(() => createMemoryProvider(), [])
  const enterpriseGateway = useMemo(() => createEnterpriseGateway(), [])
  const [enterpriseStatus, setEnterpriseStatus] = useState<EnterpriseStatus>({
    ...localEnterpriseStatus,
    health: 'checking',
  })
  const [memories, setMemories] = useState<WorkflowMemory[]>([])
  const [memoryStatus, setMemoryStatus] = useState<MemoryStatus>({
    provider: 'local',
    health: 'checking',
    label: '正在检查记忆层',
    detail: '正在确认 Letta Bridge 或本地记忆是否可用。',
  })
  const [memoryLoading, setMemoryLoading] = useState(true)
  const [startingAppId, setStartingAppId] = useState<string | null>(null)
  const [editingAppId, setEditingAppId] = useState<string | null>(null)
  const [preflightAppId, setPreflightAppId] = useState<string | null>(null)

  useEffect(() => saveWorkspace(state), [state])

  const refreshMemory = useCallback(async () => {
    setMemoryLoading(true)
    const [status, storedMemories] = await Promise.all([
      memoryProvider.status(),
      memoryProvider.list(),
    ])
    setMemoryStatus(status)
    setMemories(storedMemories)
    setMemoryLoading(false)
  }, [memoryProvider])

  useEffect(() => {
    let active = true
    void Promise.all([memoryProvider.status(), memoryProvider.list()]).then(([status, storedMemories]) => {
      if (!active) return
      setMemoryStatus(status)
      setMemories(storedMemories)
      setMemoryLoading(false)
    })
    return () => { active = false }
  }, [memoryProvider])

  useEffect(() => {
    let active = true
    void enterpriseGateway.status()
      .then((status) => { if (active) setEnterpriseStatus(status) })
      .catch((error) => {
        if (active) setEnterpriseStatus(degradedEnterpriseStatus(error instanceof Error ? error.message : '企业网关不可达'))
      })
    return () => { active = false }
  }, [enterpriseGateway])

  function navigate(next: View) {
    setView(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function startBuild(prompt = '') {
    setBuildPrompt(prompt)
    navigate('build')
  }

  function createApp(app: AgentApp) {
    setState((current) => ({ ...current, apps: [app, ...current.apps] }))
    navigate('workspace')
  }

  function saveWorkflow(appId: string, update: WorkflowUpdate) {
    setState((current) => ({
      ...current,
      apps: current.apps.map((app) => app.id === appId ? updateAgentWorkflow(app, update, capabilityCatalog) : app),
    }))
    setEditingAppId(null)
  }

  function restoreWorkflow(appId: string, versionId: string) {
    setState((current) => ({
      ...current,
      apps: current.apps.map((app) => app.id === appId ? restoreAgentWorkflow(app, versionId, capabilityCatalog) : app),
    }))
    setEditingAppId(null)
  }

  async function startRun(app: AgentApp) {
    setStartingAppId(app.id)
    try {
      const enterpriseCheck = await enterpriseGateway.preflight(app)
      if (!enterpriseCheck.allowed) throw new Error(enterpriseCheck.errors[0] ?? '企业策略拒绝运行')
      const matches = await memoryProvider.search(app, 1)
      const result = getRuntime(app.runtime).start(app, { workflowMatch: matches[0] })
      setState((current) => ({
        ...current,
        runs: [result.run, ...current.runs],
        audits: [result.audit, ...current.audits],
      }))
      navigate('run')
      setPreflightAppId(null)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '应用无法运行')
    } finally {
      setStartingAppId(null)
    }
  }

  async function rememberCompletedRun(run: AgentRun) {
    const app = state.apps.find((item) => item.id === run.appId)
    if (!app) return
    await memoryProvider.remember(app, run)
    await refreshMemory()
  }

  async function decideRun(runId: string, approved: boolean) {
    const target = state.runs.find((run) => run.id === runId)
    if (!target) return
    const app = state.apps.find((item) => item.id === target.appId)
    if (!app) return
    const transition = advanceRunApproval(app, target, approved)
    let nextRun = transition.run
    if (
      approved
      && target.capability?.resource === 'enterprise-knowledge'
      && !target.knowledgeSources?.length
    ) {
      const knowledgeSources = await enterpriseGateway.searchKnowledge(`${app.prompt} ${app.name}`, 4)
      nextRun = { ...nextRun, knowledgeSources }
    }
    setState((current) => {
      const action = target.capability?.label ?? target.appName
      const audit = createAudit(
        runId,
        approved ? 'approved' : 'denied',
        `${approved ? '批准' : '拒绝'} ${action}`,
        target.capability?.risk ?? 0,
      )
      return {
        ...current,
        runs: current.runs.map((run) => run.id === runId ? nextRun : run),
        audits: [audit, ...current.audits],
      }
    })
    if (transition.completed) await rememberCompletedRun(nextRun)
  }

  async function completeRun(runId: string) {
    const target = state.runs.find((run) => run.id === runId)
    if (!target || target.status !== 'running') return
    const completedRun: AgentRun = {
      ...target,
      status: 'completed',
      progress: 100,
      summary: target.workflowMatch
        ? `已参考「${target.workflowMatch.title}」完成任务，并沉淀本次改进。`
        : '任务已完成，步骤与结果已沉淀为可复用流程。',
      phases: finishRunPhases(target.phases),
    }
    setState((current) => ({
      ...current,
      runs: current.runs.map((run) => run.id === runId ? completedRun : run),
      audits: [createAudit(runId, 'allowed', `完成并沉淀 ${target.appName}`, 0), ...current.audits],
    }))
    await rememberCompletedRun(completedRun)
  }

  async function forgetMemory(memory: WorkflowMemory) {
    await memoryProvider.forget(memory)
    await refreshMemory()
  }

  const pendingCount = state.runs.filter((run) => run.status === 'waiting').length
  const editingApp = state.apps.find((app) => app.id === editingAppId)
  const preflightApp = state.apps.find((app) => app.id === preflightAppId)

  return (
    <Shell activeView={view} pendingCount={pendingCount} onNavigate={navigate}>
      {view === 'ask' ? <AskView onBuild={startBuild} /> : null}
      {view === 'build' ? <BuildView initialPrompt={buildPrompt} onCreate={createApp} /> : null}
      {view === 'run' ? <RunView runs={state.runs} onApprove={(id) => void decideRun(id, true)} onDeny={(id) => void decideRun(id, false)} onComplete={(id) => void completeRun(id)} /> : null}
      {view === 'memory' ? <MemoryView memories={memories} status={memoryStatus} loading={memoryLoading} onRefresh={() => void refreshMemory()} onForget={(memory) => void forgetMemory(memory)} /> : null}
      {view === 'workspace' ? <WorkspaceView apps={state.apps} audits={state.audits} enterprise={enterpriseStatus} startingAppId={startingAppId} onBuild={() => startBuild()} onEdit={(app) => setEditingAppId(app.id)} onRun={(app) => setPreflightAppId(app.id)} /> : null}
      {editingApp ? <WorkflowEditor app={editingApp} onClose={() => setEditingAppId(null)} onSave={(update) => saveWorkflow(editingApp.id, update)} onRestore={(versionId) => restoreWorkflow(editingApp.id, versionId)} /> : null}
      {preflightApp ? <RunPreflight app={preflightApp} starting={startingAppId === preflightApp.id} onClose={() => setPreflightAppId(null)} onEdit={() => { setPreflightAppId(null); setEditingAppId(preflightApp.id) }} onConfirm={() => void startRun(preflightApp)} /> : null}
    </Shell>
  )
}
