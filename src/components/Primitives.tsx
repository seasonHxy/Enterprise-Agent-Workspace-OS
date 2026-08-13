import { CheckCircle2, Cloud, Laptop, LoaderCircle, ShieldAlert, Timer, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { riskLabels } from '../core/policy'
import type { RiskLevel, RunStatus, RuntimeKind } from '../core/types'

export function RuntimeBadge({ runtime }: { runtime: RuntimeKind }) {
  const Icon = runtime === 'local' ? Laptop : Cloud
  return <span className={`runtime-badge ${runtime}`}><Icon size={14} />{runtime === 'local' ? '本地' : '云沙箱'}</span>
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return <span className={`risk-badge risk-${risk}`}>L{risk} · {riskLabels[risk]}</span>
}

const statusMeta: Record<RunStatus, { label: string; icon: typeof CheckCircle2 }> = {
  running: { label: '执行中', icon: LoaderCircle },
  waiting: { label: '待审批', icon: ShieldAlert },
  completed: { label: '已完成', icon: CheckCircle2 },
  failed: { label: '失败', icon: XCircle },
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const meta = statusMeta[status]
  const Icon = meta.icon
  return <span className={`run-status ${status}`}><Icon size={14} />{meta.label}</span>
}

export function EmptyState({ icon, title, body }: { icon?: ReactNode; title: string; body: string }) {
  return <div className="empty-state">{icon ?? <Timer size={24} />}<strong>{title}</strong><span>{body}</span></div>
}
