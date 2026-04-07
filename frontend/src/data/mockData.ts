// 假数据 - 当前用户
export const currentUser = {
  name: 'Creative Director',
  role: '高级编辑模式',
}

export const workspaces = [
  {
    title: '资深产品经理',
    domain: '互联网 / Fintech 领域',
    subResumeCount: 12,
    lastModified: '2 小时前',
    coverStyle: 'food' as const,
    isActive: true,
  },
  {
    title: '高级全栈工程师',
    domain: '系统架构 / 云计算',
    subResumeCount: 5,
    lastModified: '昨天 14:20',
    coverStyle: 'portrait' as const,
  },
  {
    title: 'UI/UX 设计专家',
    domain: '创意设计 / 交互体验',
    subResumeCount: 28,
    lastModified: '15 分钟前',
    coverStyle: 'plant' as const,
  },
]
