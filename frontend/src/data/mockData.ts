// 假数据 - 当前用户
export const currentUser = {
  name: 'Creative Director',
  role: '高级编辑模式',
}

export const workspaces = [
  {
    title: '资深产品经理',
    domain: '互联网 / Fintech 领域',
    subResumeIds: ['resume-1', 'resume-2', 'resume-3'],
    lastModified: '2 小时前',
    coverStyle: 'food' as const,
    isActive: true,
  },
  {
    title: '高级全栈工程师',
    domain: '系统架构 / 云计算',
    subResumeIds: ['resume-4', 'resume-5'],
    lastModified: '昨天 14:20',
    coverStyle: 'portrait' as const,
  },
  {
    title: 'UI/UX 设计专家',
    domain: '创意设计 / 交互体验',
    subResumeIds: [
      'resume-6', 'resume-7', 'resume-8', 'resume-9', 'resume-10',
      'resume-11', 'resume-12', 'resume-13', 'resume-14', 'resume-15',
    ],
    lastModified: '15 分钟前',
    coverStyle: 'plant' as const,
  },
]
