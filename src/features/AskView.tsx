import { ArrowUp, Bot, FileText, Globe2, Paperclip, ShieldCheck, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
}

const starters = [
  { icon: FileText, title: '整理项目文件', body: '仅在绑定的本地工作区读取' },
  { icon: Globe2, title: '研究一个市场', body: '用公开网页生成来源报告' },
  { icon: ShieldCheck, title: '检查执行风险', body: '审阅应用权限与审批策略' },
]

export function AskView({ onBuild }: { onBuild: (prompt: string) => void }) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])

  function submit(event: FormEvent) {
    event.preventDefault()
    const prompt = input.trim()
    if (!prompt) return
    setMessages((current) => [
      ...current,
      { id: Date.now(), role: 'user', content: prompt },
      {
        id: Date.now() + 1,
        role: 'assistant',
        content: '这是本地演示模式。我可以把这个需求转换成一个带运行时与权限声明的 Agent App，供你检查后运行。',
      },
    ])
    setInput('')
  }

  return (
    <div className="ask-view view-enter">
      {messages.length === 0 ? (
        <section className="ask-hero">
          <div className="hero-symbol"><Sparkles size={25} /></div>
          <p className="eyebrow">一个入口，两个安全执行面</p>
          <h1>今天想完成什么？</h1>
          <p className="hero-description">在本地处理私有上下文，在云端运行和共享应用。每一项敏感操作，都先经过权限策略。</p>
        </section>
      ) : (
        <div className="conversation" aria-live="polite">
          {messages.map((message) => (
            <div className={`message ${message.role}`} key={message.id}>
              <span className="message-avatar">{message.role === 'assistant' ? <Bot size={17} /> : 'W'}</span>
              <div><small>{message.role === 'assistant' ? 'AWOS Agent' : '你'}</small><p>{message.content}</p></div>
            </div>
          ))}
          <button className="secondary-button build-from-chat" onClick={() => onBuild(messages[0]?.content ?? '')}>
            <Sparkles size={16} /> 转换为 Agent App
          </button>
        </div>
      )}

      <form className="composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="ask-input">询问 Agent</label>
        <textarea
          id="ask-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder="描述一个目标，例如：每周研究竞品变化并生成一页简报…"
          rows={3}
        />
        <div className="composer-actions">
          <div className="composer-tools">
            <button type="button" className="icon-button" aria-label="添加附件"><Paperclip size={18} /></button>
            <button type="button" className="model-selector"><span className="status-orb" /> Auto · 本地优先</button>
          </div>
          <button className="send-button" aria-label="发送" disabled={!input.trim()}><ArrowUp size={19} /></button>
        </div>
      </form>

      {messages.length === 0 ? (
        <div className="starter-grid">
          {starters.map((starter) => {
            const Icon = starter.icon
            return (
              <button key={starter.title} onClick={() => setInput(starter.title)}>
                <span className="starter-icon"><Icon size={19} /></span>
                <span><strong>{starter.title}</strong><small>{starter.body}</small></span>
              </button>
            )
          })}
        </div>
      ) : null}
      <p className="privacy-note"><ShieldCheck size={14} /> Agent 只有获得明确 Capability 后才能访问外部资源。</p>
    </div>
  )
}
