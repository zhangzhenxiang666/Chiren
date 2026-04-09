import { useState, useEffect, useRef } from 'react'
import { X, Eye, EyeOff, Loader2, ChevronDown, Settings, Cpu } from 'lucide-react'
import { getProviderConfig, updateProviderConfig, switchProviderConfig, type ProviderType } from '../../lib/api'

export interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

export type SettingsTab = 'ai' | 'appearance' | 'editor'

const PROVIDER_OPTIONS: { value: ProviderType; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
]

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<SettingsTab>('ai')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [activeProvider, setActiveProvider] = useState<ProviderType>('openai')
  const [config, setConfig] = useState<Record<ProviderType, { base_url: string; api_key: string; model: string }>>({
    openai: { base_url: '', api_key: '', model: '' },
    anthropic: { base_url: '', api_key: '', model: '' },
  })
  const [showApiKey, setShowApiKey] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const configRef = useRef(config)

  useEffect(() => {
    if (open && tab === 'ai') {
      loadConfig()
    }
  }, [open, tab])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const data = await getProviderConfig()
      if (data.active) setActiveProvider(data.active)
      if (data.providers) {
        setConfig((prev) => {
          const next = {
            openai: { ...prev.openai, ...data.providers?.openai },
            anthropic: { ...prev.anthropic, ...data.providers?.anthropic },
          }
          configRef.current = next
          return next
        })
      }
    } catch (error) {
      console.error('Failed to load config:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async () => {
    const current = configRef.current[activeProvider]
    const payload: Record<string, string> = {}
    if (current.base_url) payload.base_url = current.base_url
    if (current.api_key) payload.api_key = current.api_key
    if (current.model) payload.model = current.model

    if (Object.keys(payload).length === 0) return

    setSaving(true)
    try {
      await updateProviderConfig(activeProvider, payload)
    } catch (error) {
      console.error('Failed to save config:', error)
    } finally {
      setSaving(false)
    }
  }

  const updateCurrentProviderConfig = (field: 'base_url' | 'api_key' | 'model', value: string) => {
    setConfig((prev) => {
      const next = {
        ...prev,
        [activeProvider]: {
          ...prev[activeProvider],
          [field]: value,
        },
      }
      configRef.current = next
      return next
    })

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(saveConfig, 1500)
  }

  const handleClose = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    onClose()
  }

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  if (!open) return null

  const currentProvider = config[activeProvider] ?? { base_url: '', api_key: '', model: '' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-[560px] bg-[#1c1c1e] border border-[#2a2a2e] rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-400" />
            <h2 className="text-xl font-semibold text-white">设置</h2>
          </div>
          <button
            onClick={handleClose}
            className="cursor-pointer text-gray-500 hover:text-gray-300 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mx-6 mb-6 flex gap-1 rounded-lg bg-zinc-800 p-1">
          <button
            type="button"
            className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              tab === 'ai'
                ? 'bg-zinc-700 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            onClick={() => setTab('ai')}
          >
            <Cpu className="w-4 h-4" />
            AI 配置
          </button>
          <button
            type="button"
            className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === 'appearance'
                ? 'bg-zinc-700 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            onClick={() => setTab('appearance')}
          >
            外观
          </button>
          <button
            type="button"
            className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === 'editor'
                ? 'bg-zinc-700 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            onClick={() => setTab('editor')}
          >
            编辑器
          </button>
        </div>

        <div className="px-6 pb-6 flex-1 overflow-y-auto">
          {tab === 'ai' ? (
            loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    模型协议
                  </label>
                  <div className="relative">
                    <select
                      value={activeProvider}
                      onChange={(e) => {
                        const nextProvider = e.target.value as ProviderType
                        setActiveProvider(nextProvider)
                        if (saveTimeoutRef.current) {
                          clearTimeout(saveTimeoutRef.current)
                        }
                        saveTimeoutRef.current = setTimeout(async () => {
                          setSaving(true)
                          try {
                            await switchProviderConfig(nextProvider)
                          } catch (error) {
                            console.error('Failed to switch provider:', error)
                          } finally {
                            setSaving(false)
                          }
                        }, 1500)
                      }}
                      className="w-full px-4 py-2.5 bg-[#121214] border border-[#2a2a2e] rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 text-sm"
                    >
                      {PROVIDER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={currentProvider.api_key}
                      onChange={(e) => updateCurrentProviderConfig('api_key', e.target.value)}
                      placeholder="输入 API Key..."
                      className="w-full px-4 py-2.5 pr-10 bg-[#121214] border border-[#2a2a2e] rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors cursor-pointer"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    API 地址
                  </label>
                  <input
                    type="text"
                    value={currentProvider.base_url}
                    onChange={(e) => updateCurrentProviderConfig('base_url', e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full px-4 py-2.5 bg-[#121214] border border-[#2a2a2e] rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    默认模型
                  </label>
                  <input
                    type="text"
                    value={currentProvider.model}
                    onChange={(e) => updateCurrentProviderConfig('model', e.target.value)}
                    placeholder="gpt-4"
                    className="w-full px-4 py-2.5 bg-[#121214] border border-[#2a2a2e] rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 text-sm"
                  />
                </div>
              </div>
            )
          ) : tab === 'appearance' ? (
            <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
              外观配置开发中...
            </div>
          ) : (
            <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
              编辑器配置开发中...
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-[#2a2a2e]">
          <button
            onClick={handleClose}
            className="cursor-pointer px-5 py-2 rounded-lg border border-[#2a2a2e] text-gray-400 hover:text-white hover:border-[#3a3a3c] transition-colors text-sm font-medium"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
