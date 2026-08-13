import {
  AppWindow,
  Blocks,
  Bot,
  BrainCircuit,
  CircleHelp,
  Command,
  LayoutGrid,
  Play,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { View } from '../core/types'

const navigation: Array<{ id: View; label: string; icon: typeof Bot }> = [
  { id: 'ask', label: 'Ask', icon: Sparkles },
  { id: 'build', label: 'Build', icon: Blocks },
  { id: 'run', label: 'Run', icon: Play },
  { id: 'memory', label: 'Memory', icon: BrainCircuit },
  { id: 'workspace', label: 'Workspace', icon: LayoutGrid },
]

interface ShellProps {
  activeView: View
  pendingCount: number
  onNavigate: (view: View) => void
  children: ReactNode
}

export function Shell({ activeView, pendingCount, onNavigate, children }: ShellProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        跳转到主要内容
      </a>
      <aside className="sidebar">
        <button className="brand" aria-label="Agent Workspace OS 首页" onClick={() => onNavigate('ask')}>
          <span className="brand-mark"><Command size={18} /></span>
          <span className="brand-copy">
            <strong>AWOS</strong>
            <small>Agent Workspace</small>
          </span>
        </button>

        <nav className="primary-nav" aria-label="主导航">
          <span className="nav-eyebrow">工作台</span>
          {navigation.map((item) => {
            const Icon = item.icon
            const active = activeView === item.id
            return (
              <button
                className={`nav-item ${active ? 'active' : ''}`}
                key={item.id}
                aria-current={active ? 'page' : undefined}
                onClick={() => onNavigate(item.id)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
                {item.id === 'run' && pendingCount > 0 ? (
                  <span className="nav-badge" aria-label={`${pendingCount} 个任务待审批`}>
                    {pendingCount}
                  </span>
                ) : null}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-spacer" />
        <div className="runtime-card">
          <div className="runtime-card-head">
            <span className="status-orb" />
            <span>双运行时在线</span>
          </div>
          <div className="runtime-pair">
            <span><AppWindow size={14} /> Local</span>
            <span><Bot size={14} /> Cloud</span>
          </div>
        </div>
        <nav className="secondary-nav" aria-label="辅助导航">
          <button><Settings size={18} /><span>设置</span></button>
          <button><CircleHelp size={18} /><span>帮助与文档</span></button>
        </nav>
        <div className="user-chip">
          <span className="avatar">W</span>
          <span><strong>Personal Space</strong><small>Owner · Local first</small></span>
        </div>
      </aside>

      <section className="workspace-shell">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><Command size={17} /></span><strong>AWOS</strong></div>
          <button className="command-search" onClick={() => onNavigate('ask')}>
            <Search size={17} />
            <span>搜索工作区或询问 Agent</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="top-actions">
            <span className="secure-state"><span className="status-orb" /> Gatekeeper 在线</span>
            <button className="icon-button" aria-label="打开应用列表"><AppWindow size={19} /></button>
          </div>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>{children}</main>
      </section>

      <nav className="mobile-nav" aria-label="移动端主导航">
        {navigation.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={activeView === item.id ? 'active' : ''}
              aria-current={activeView === item.id ? 'page' : undefined}
              onClick={() => onNavigate(item.id)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
