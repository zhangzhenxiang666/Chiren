import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

export interface InterviewerProfile {
  name: string
  title: string
  bio: string
  questionStyle: string
  assessmentDimensions: string[]
  personalityTraits: string[]
}

interface CustomInterviewerModalProps {
  open: boolean
  onClose: () => void
  initialValues?: InterviewerProfile
  isEdit?: boolean
  onSubmit: (profile: InterviewerProfile) => void
}

export default function CustomInterviewerModal({
  open,
  onClose,
  initialValues,
  isEdit,
  onSubmit,
}: CustomInterviewerModalProps) {
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [bio, setBio] = useState('')
  const [questionStyle, setQuestionStyle] = useState('')
  const [assessmentDimensions, setAssessmentDimensions] = useState('')
  const [personalityTraits, setPersonalityTraits] = useState('')

  useEffect(() => {
    if (open && initialValues) {
      setName(initialValues.name)
      setTitle(initialValues.title)
      setBio(initialValues.bio)
      setQuestionStyle(initialValues.questionStyle)
      setAssessmentDimensions(initialValues.assessmentDimensions.join('，'))
      setPersonalityTraits(initialValues.personalityTraits.join('，'))
    } else if (!open) {
      setName('')
      setTitle('')
      setBio('')
      setQuestionStyle('')
      setAssessmentDimensions('')
      setPersonalityTraits('')
    }
  }, [open, initialValues])

  const isValid = name.trim() && title.trim() && bio.trim() && questionStyle.trim() && assessmentDimensions.trim()

  if (!open) return null

  const handleSubmit = () => {
    if (!isValid) return
    onSubmit({
      name: name.trim(),
      title: title.trim(),
      bio: bio.trim(),
      questionStyle: questionStyle.trim(),
      assessmentDimensions: assessmentDimensions
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
      personalityTraits: personalityTraits
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
    })
    setName('')
    setTitle('')
    setBio('')
    setQuestionStyle('')
    setAssessmentDimensions('')
    setPersonalityTraits('')
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold">{isEdit ? '编辑面试官' : '自定义面试官'}</h2>
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
              面试官名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：产品总监"
              className="w-full px-3 py-2 bg-background border border-foreground/10 rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              职位头衔 <span className="text-pink-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="如：产品副总裁"
              className="w-full px-3 py-2 bg-background border border-foreground/10 rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              简介 <span className="text-pink-400">*</span>
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="描述面试官的背景..."
              rows={2}
              className="w-full px-3 py-2 bg-background border border-foreground/10 rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 resize-none"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              提问风格 <span className="text-pink-400">*</span>
            </label>
            <input
              type="text"
              value={questionStyle}
              onChange={(e) => setQuestionStyle(e.target.value)}
              placeholder="描述提问方式..."
              className="w-full px-3 py-2 bg-background border border-foreground/10 rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              考察维度（逗号分隔） <span className="text-pink-400">*</span>
            </label>
            <input
              type="text"
              value={assessmentDimensions}
              onChange={(e) => setAssessmentDimensions(e.target.value)}
              placeholder="如：产品思维, 数据分析, 用户洞察"
              className="w-full px-3 py-2 bg-background border border-foreground/10 rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              性格特征
            </label>
            <input
              type="text"
              value={personalityTraits}
              onChange={(e) => setPersonalityTraits(e.target.value)}
              placeholder="如：严谨、注重细节"
              className="w-full px-3 py-2 bg-background border border-foreground/10 rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid}
          className="w-full mt-6 px-4 py-2 rounded-lg bg-pink-500 text-white text-sm font-medium hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
           {isEdit ? '保存' : '添加'}
        </button>
      </div>
    </div>
  )
}
