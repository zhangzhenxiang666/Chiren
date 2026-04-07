export interface WorkspaceCardProps {
  title: string
  domain: string
  subResumeCount: number
  lastModified: string
  coverStyle: 'food' | 'portrait' | 'plant'
  isActive?: boolean
}

function FoodCover() {
  return (
    <svg viewBox="0 0 320 160" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="food-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a3a3c" />
          <stop offset="100%" stopColor="#252525" />
        </linearGradient>
        <linearGradient id="bowl-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a4a4c" />
          <stop offset="100%" stopColor="#2a2a2c" />
        </linearGradient>
        <radialGradient id="food-ball-1" cx="0.35" cy="0.2" r="0.6">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
        <radialGradient id="food-ball-2" cx="0.3" cy="0.2" r="0.7">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="100%" stopColor="#dc2626" />
        </radialGradient>
        <radialGradient id="food-ball-3" cx="0.3" cy="0.15" r="0.6">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </radialGradient>
      </defs>
      <rect width="320" height="160" fill="url(#food-bg)" />
      <path d="M80 100 Q80 145 160 145 Q240 145 240 100" fill="url(#bowl-grad)" stroke="#555" strokeWidth="2" />
      <ellipse cx="160" cy="100" rx="80" ry="15" fill="#3a3a3c" stroke="#555" strokeWidth="1.5" />
      <circle cx="120" cy="88" r="22" fill="url(#food-ball-1)" />
      <circle cx="120" cy="84" r="18" fill="url(#food-ball-1)" opacity="0.9" />
      <circle cx="160" cy="82" r="26" fill="url(#food-ball-2)" />
      <circle cx="160" cy="78" r="22" fill="url(#food-ball-2)" opacity="0.9" />
      <circle cx="200" cy="86" r="20" fill="url(#food-ball-3)" />
      <circle cx="200" cy="82" r="16" fill="url(#food-ball-3)" opacity="0.9" />
      <ellipse cx="110" cy="78" rx="6" ry="4" fill="white" opacity="0.4" />
      <ellipse cx="152" cy="72" rx="8" ry="5" fill="white" opacity="0.4" />
      <ellipse cx="192" cy="78" rx="5" ry="3" fill="white" opacity="0.4" />
    </svg>
  )
}

function PortraitCover() {
  return (
    <svg viewBox="0 0 320 160" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="port-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2d1b4e" />
          <stop offset="100%" stopColor="#1a1a2e" />
        </linearGradient>
        <linearGradient id="person-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <radialGradient id="head-light" cx="0.3" cy="0.2" r="0.7">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#4f46e5" />
        </radialGradient>
      </defs>
      <rect width="320" height="160" fill="url(#port-bg)" />
      <circle cx="160" cy="65" r="80" fill="url(#person-body)" opacity="0.2" />
      <circle cx="160" cy="65" r="60" fill="url(#person-body)" opacity="0.3" />
      <circle cx="160" cy="55" r="28" fill="url(#head-light)" />
      <circle cx="150" cy="45" r="8" fill="white" opacity="0.2" />
      <path d="M105 140 Q105 100 130 90 Q160 80 190 90 Q215 100 215 140" fill="url(#person-body)" />
      <path d="M120 130 Q120 105 140 98 Q160 90 180 98 Q200 105 200 130" fill="url(#person-body)" opacity="0.7" />
      <line x1="220" y1="40" x2="280" y2="30" stroke="#818cf8" strokeWidth="1.5" opacity="0.5" />
      <line x1="230" y1="60" x2="300" y2="50" stroke="#818cf8" strokeWidth="1.5" opacity="0.3" />
      <line x1="30" y1="50" x2="80" y2="40" stroke="#f472b6" strokeWidth="1.5" opacity="0.4" />
    </svg>
  )
}

function PlantCover() {
  return (
    <svg viewBox="0 0 320 160" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="plant-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e3a2f" />
          <stop offset="100%" stopColor="#1a2a1a" />
        </linearGradient>
        <linearGradient id="pot-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#b45309" />
          <stop offset="50%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="leaf-1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="leaf-2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <rect width="320" height="160" fill="url(#plant-bg)" />
      <ellipse cx="200" cy="50" rx="40" ry="30" fill="#34d399" opacity="0.08" />
      <ellipse cx="120" cy="40" rx="30" ry="25" fill="#34d399" opacity="0.06" />
      <path d="M130 120 L140 155 L180 155 L190 120 Z" fill="url(#pot-grad)" />
      <rect x="120" y="115" width="80" height="10" rx="3" fill="#92400e" />
      <rect x="125" y="110" width="70" height="8" rx="2" fill="#b45309" />
      <path d="M160 110 L160 40" stroke="#065f46" strokeWidth="3" strokeLinecap="round" />
      <path d="M160 80 Q140 60 120 50 Q130 40 160 65" fill="url(#leaf-1)" />
      <path d="M160 70 Q180 50 200 45 Q190 35 160 55" fill="url(#leaf-2)" />
      <path d="M160 95 Q135 85 115 80 Q125 70 160 85" fill="url(#leaf-2)" />
      <path d="M160 55 Q185 40 210 30 Q200 20 160 40" fill="url(#leaf-1)" />
      <path d="M160 40 Q150 25 145 20 Q155 15 160 30" fill="url(#leaf-1)" />
      <path d="M160 45 Q170 30 175 25 Q165 20 160 35" fill="url(#leaf-2)" />
      <ellipse cx="145" cy="75" rx="5" ry="3" fill="white" opacity="0.2" />
      <ellipse cx="175" cy="55" rx="4" ry="2" fill="white" opacity="0.2" />
    </svg>
  )
}

function CoverImage({ style }: { style: WorkspaceCardProps['coverStyle'] }) {
  switch (style) {
    case 'food':
      return <FoodCover />
    case 'portrait':
      return <PortraitCover />
    case 'plant':
      return <PlantCover />
  }
}

export default function WorkspaceCard({
  title,
  domain,
  subResumeCount,
  lastModified,
  coverStyle,
  isActive = false,
}: WorkspaceCardProps) {
  return (
    <div className={`rounded-2xl bg-[#1e1e20] overflow-hidden group hover:border-[#3a3a3c] transition-colors duration-200 cursor-pointer border border-transparent ${isActive ? 'ring-2 ring-pink-500/50' : ''}`}>
      <div className="relative w-full">
        <CoverImage style={coverStyle} />
      </div>

      <div className="p-4 space-y-2">
        <h3 className="text-white font-semibold text-base truncate">{title}</h3>
        <p className="text-gray-400 text-sm truncate">{domain}</p>
        <div className="flex items-center justify-between pt-2 border-t border-[#2c2c2e]">
          <span className="text-gray-300 text-xs font-medium">
            {subResumeCount} 个子简历
          </span>
          <span className="text-gray-500 text-xs">
            {lastModified}
          </span>
        </div>
      </div>
    </div>
  )
}
