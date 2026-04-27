import { useState } from 'react'
import { X } from 'lucide-react'
import type { CreateInterviewRoundParams } from '@/types/interview'

interface AddRoundModalProps {
  open: boolean
  onClose: () => void
  interviewCollectionId: string
  nextSortOrder: number
  onSubmit: (params: CreateInterviewRoundParams) => Promise<void>
}

export default function AddRoundModal({
  open,
  onClose,
  interviewCollectionId,
  nextSortOrder,
  onSubmit,
}: AddRoundModalProps) {
  const [name, setName] = useState('')
  const [interviewerName, setInterviewerName] = useState('')
  const [interviewerTitle, setInterviewerTitle] = useState('')
  const [interviewerBio, setInterviewerBio] = useState('')
  const [questionStyle, setQuestionStyle] = useState('')
  const [assessmentDimensions, setAssessmentDimensions] = useState('')
  const [personalityTraits, setPersonalityTraits] = useState('')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const handleSubmit = async () => {
    if (!name.trim() || !interviewerName.trim()) return
    setLoading(true)
    try {
      await onSubmit({
        interviewCollectionId,
        name: name.trim(),
        interviewerName: interviewerName.trim(),
        interviewerTitle: interviewerTitle.trim(),
        interviewerBio: interviewerBio.trim(),
        questionStyle: questionStyle.trim(),
        assessmentDimensions: assessmentDimensions
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        personalityTraits: personalityTraits
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        sortOrder: nextSortOrder,
      })
      setName('')
      setInterviewerName('')
      setInterviewerTitle('')
      setInterviewerBio('')
      setQuestionStyle('')
      setAssessmentDimensions('')
      setPersonalityTraits('')
      onClose()
    } catch {
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl p-6 w-full max-w-lg mx-4 shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">添加面试轮次</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              轮次名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：技术一面"
              className="w-full px-3 py-2 bg-background border border-foreground/10 rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              面试官名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={interviewerName}
              onChange={(e) => setInterviewerName(e.target.value)}
              placeholder="例如：张工"
              className="w-full px-3 py-2 bg-background border border-foreground/10 rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              面试官头衔
            </label>
            <input
              type="text"
              value={interviewerTitle}
              onChange={(e) => setInterviewerTitle(e.target.value)}
              placeholder="例如：技术架构师"
              className="w-full px-3 py-2 bg-background border border-foreground/10 rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              面试官简介
            </label>
            <textarea
              value={interviewerBio}
              onChange={(e) => setInterviewerBio(e.target.value)}
              placeholder="描述面试官的背景和风格"
              rows={2}
              className="w-full px-3 py-2 bg-background border border-foreground/10 rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 resize-none"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              提问风格
            </label>
            <input
              type="text"
              value={questionStyle}
              onChange={(e) => setQuestionStyle(e.target.value)}
              placeholder="例如：由浅入深、追问细节"
              className="w-full px-3 py-2 bg-background border border-foreground/10 rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              考察维度（逗号分隔）
            </label>
            <input
              type="text"
              value={assessmentDimensions}
              onChange={(e) => setAssessmentDimensions(e.target.value)}
              placeholder="例如：算法能力, 系统设计, 代码质量"
              className="w-full px-3 py-2 bg-background border border-foreground/10 rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              性格特征（逗号分隔）
            </label>
            <input
              type="text"
              value={personalityTraits}
              onChange={(e) => setPersonalityTraits(e.target.value)}
              placeholder="例如：严谨, 善于引导, 注重实践"
              className="w-full px-3 py-2 bg-background border border-foreground/10 rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !name.trim() || !interviewerName.trim()}
          className="w-full mt-6 px-4 py-2 rounded-lg bg-pink-500 text-white text-sm font-medium hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '添加中...' : '添加轮次'}
        </button>
      </div>
    </div>
  )
}
