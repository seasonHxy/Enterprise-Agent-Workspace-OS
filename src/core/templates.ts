import { capabilityCatalog } from './seed'
import type { AgentApp, WorkflowTemplate } from './types'

export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: 'template-release',
    name: '研发版本发布',
    description: '检查变更与测试，生成发布说明，经审批后创建 Pull Request。',
    category: 'engineering',
    prompt: '检查当前工作区的代码变更，运行质量检查，整理发布说明；GitHub 写入必须在用户确认后执行。',
    expectedOutput: '测试结果、风险摘要、Release Notes 与 Pull Request 草稿',
    runtime: 'local',
    capabilityIds: ['workspace-files', 'github-write'],
    steps: ['读取并归类代码变更', '运行测试与静态检查', '生成发布说明与风险摘要', '审批后创建 Pull Request'],
  },
  {
    id: 'template-market-watch',
    name: '竞品情报周报',
    description: '定期追踪竞品变化，交叉核对来源并输出结构化简报。',
    category: 'research',
    prompt: '追踪指定行业和竞品最近一周的重要变化，至少使用两个独立公开来源核对，并生成一页中文管理层简报。',
    expectedOutput: '变化清单、可信来源、影响判断与下周关注项',
    runtime: 'cloud',
    capabilityIds: ['web-research'],
    steps: ['确定竞品与时间窗口', '检索并聚类公开信息', '交叉核对重要变化', '生成带来源的管理层简报'],
    schedule: '每周一 09:00',
  },
  {
    id: 'template-incident-review',
    name: '故障复盘助手',
    description: '读取绑定目录中的日志和变更，形成时间线、根因假设与行动项。',
    category: 'operations',
    prompt: '分析工作区内的故障日志、部署记录和变更说明，重建时间线，区分事实与假设，并输出可跟踪的改进项。',
    expectedOutput: '故障时间线、根因树、证据缺口与责任明确的行动项',
    runtime: 'local',
    capabilityIds: ['workspace-files'],
    steps: ['收集日志与变更证据', '重建故障时间线', '验证根因假设', '生成行动项与验证标准'],
  },
  {
    id: 'template-content-brief',
    name: '内容选题研究',
    description: '从公开信号提炼选题，建立证据边界并生成可执行内容简报。',
    category: 'content',
    prompt: '研究指定主题的近期公开讨论与可信资料，提炼用户痛点和差异化角度，生成不夸大事实的内容简报。',
    expectedOutput: '受众痛点、证据来源、标题方向、内容大纲与风险提示',
    runtime: 'cloud',
    capabilityIds: ['web-research'],
    steps: ['定义受众与问题', '收集公开讨论和权威资料', '提炼冲突与差异化角度', '生成带证据边界的内容简报'],
  },
]

export function createAppFromTemplate(template: WorkflowTemplate, now = new Date()): AgentApp {
  return {
    id: `app-${now.getTime()}`,
    name: template.name,
    description: template.description,
    prompt: template.prompt,
    runtime: template.runtime,
    status: 'ready',
    capabilities: capabilityCatalog.filter((capability) => template.capabilityIds.includes(capability.id)),
    templateId: template.id,
    workflowSteps: [...template.steps],
    version: 1,
    schedule: template.schedule,
    createdAt: now.toISOString(),
  }
}

export function getWorkflowTemplate(templateId?: string): WorkflowTemplate | undefined {
  return workflowTemplates.find((template) => template.id === templateId)
}
