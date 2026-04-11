import { TemplateThumbnail } from '../template/TemplateThumbnail'

export interface WorkspaceCardProps {
  title: string
  domain: string
  subResumeIds: string[]
  lastModified: string
  templateName: string
  isActive?: boolean
  onClick?: () => void
}

interface CoverImageProps {
  templateName: string
}

function CoverImage({ templateName }: CoverImageProps) {
  const isKnownTemplate = [
    'classic', 'professional', 'formal', 'elegant', 'corporate', 'ats', 'executive', 
    'consultant', 'minimal', 'modern', 'clean', 'compact', 'swiss', 'nordic', 'gradient', 
    'bold', 'two-column', 'sidebar', 'card', 'blocks', 'timeline', 'material', 'creative', 
    'artistic', 'neon', 'watercolor', 'mosaic', 'luxe', 'retro', 'magazine', 'ribbon', 
    'rose', 'zigzag', 'developer', 'coder', 'designer', 'architect', 'engineer', 
    'scientist', 'finance', 'medical', 'metro', 'legal', 'teacher', 'academic', 'startup', 
    'japanese', 'euro', 'berlin', 'infographic'
  ].includes(templateName)

  if (isKnownTemplate) {
    return (
      <div className="w-full h-full bg-zinc-800 flex items-center justify-center overflow-hidden">
        <TemplateThumbnail
          template={templateName}
          className="w-20 h-28 rounded-sm shadow-lg"
        />
      </div>
    )
  }

  // Fallback to a simple placeholder for unknown templates
  return (
    <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
      <div className="w-full h-full opacity-30" style={{
        background: 'linear-gradient(135deg, #3a3a3c 0%, #252525 100%)'
      }} />
      <span className="absolute text-zinc-500 text-xs">{templateName}</span>
    </div>
  )
}

export default function WorkspaceCard({
  title,
  domain,
  subResumeIds,
  lastModified,
  templateName,
  isActive = false,
  onClick,
}: WorkspaceCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl bg-[#1e1e20] overflow-hidden group hover:border-[#3a3a3c] transition-colors duration-200 cursor-pointer border border-transparent text-left w-full h-[280px] flex flex-col ${isActive ? 'ring-2 ring-pink-500/50' : ''}`}
    >
      <div className="pt-4">
        <div className="relative w-full h-[140px] shrink-0">
          <CoverImage templateName={templateName} />
        </div>
      </div>

      <div className="p-4 space-y-2 flex-1 min-h-0">
        <h3 className="text-white font-semibold text-base truncate">{title}</h3>
        <p className="text-gray-400 text-sm truncate">{domain}</p>
        <div className="flex items-center justify-between pt-2 border-t border-[#2c2c2e]">
          <span className="text-gray-300 text-xs font-medium">
            {subResumeIds.length} 个子简历
          </span>
          <span className="text-gray-500 text-xs">
            {lastModified}
          </span>
        </div>
      </div>
    </button>
  )
}
