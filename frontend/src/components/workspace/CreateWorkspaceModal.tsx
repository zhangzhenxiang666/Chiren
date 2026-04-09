import { useState, useEffect, useRef } from 'react'
import { X, Check, Upload, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { TemplateThumbnail } from '../template/TemplateThumbnail'
import { templateLabelsMap, TEMPLATE_ORDER } from '../../lib/template-labels'
import { getProviderConfig, uploadAndParse, type ProviderConfigItem, type ProviderType } from '../../lib/api'

export interface CreateWorkspaceModalProps {
  open: boolean
  onClose: () => void
  onCreate: (template: string, name: string) => Promise<any>
  onRefreshWs: () => void
}

export type CreateTab = 'template' | 'upload'

const ACCEPTED_EXTENSIONS = '.pdf'

export default function CreateWorkspaceModal({ open, onClose, onCreate, onRefreshWs }: CreateWorkspaceModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATE_ORDER[0])
  const [name, setName] = useState('')
  const [tab, setTab] = useState<CreateTab>('template')
  const [isCreating, setIsCreating] = useState(false)

  const [file, setFile] = useState<File | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [providerConfig, setProviderConfig] = useState<{ providers: Record<string, ProviderConfigItem>; active: string } | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const pendingTaskIdRef = useRef<string | null>(null)
  const onRefreshWsRef = useRef(onRefreshWs)
  onRefreshWsRef.current = onRefreshWs

  // 获取provider配置
  useEffect(() => {
    if (open) {
      getProviderConfig().then(setProviderConfig).catch(() => setProviderConfig(null))
    }
  }, [open])

  // 管理SSE连接生命周期，不受modal卸载影响
  useEffect(() => {
    const taskId = pendingTaskIdRef.current
    if (!taskId) return

    eventSourceRef.current = new EventSource(`http://localhost:8000/parser/stream/${taskId}`)
    eventSourceRef.current.addEventListener('status', (e: MessageEvent) => {
      if (e.data === 'success' || e.data === 'error') {
        eventSourceRef.current?.close()
        eventSourceRef.current = null
        pendingTaskIdRef.current = null
      }
    })
    eventSourceRef.current.addEventListener('result', () => {
      onRefreshWsRef.current()
      eventSourceRef.current?.close()
      eventSourceRef.current = null
      pendingTaskIdRef.current = null
    })
    eventSourceRef.current.addEventListener('error', () => {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
      pendingTaskIdRef.current = null
    })

    return () => {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
    }
  }, [pendingTaskIdRef.current])

  // 检查当前active provider是否已配置
  const activeProviderConfigured = (): ProviderConfigItem | null => {
    if (!providerConfig) return null
    const active = providerConfig.active
    const provider = providerConfig.providers[active]
    if (!provider) return null
    // 检查api_key、base_url、model是否都为空
    if (!provider.api_key && !provider.base_url && !provider.model) return null
    return provider
  }

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      await onCreate(selectedTemplate, name)
      setName('')
      setTab('template')
    } finally {
      setIsCreating(false)
    }
  }

  const handleFileSelect = (selectedFile: File) => {
    setParseError('')
    const validTypes = ['application/pdf']
    if (!validTypes.includes(selectedFile.type)) {
      setParseError('不支持的文件类型，请上传 PDF 文件')
      return
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setParseError('文件大小不能超过 10MB')
      return
    }
    const configured = activeProviderConfigured()
    if (!configured) {
      setParseError('当前供应商未配置 API，请先在设置中配置')
      return
    }
    setFile(selectedFile)
  }

  const handleUploadParse = async () => {
    if (!file) return
    const configured = activeProviderConfigured()
    if (!configured) {
      setParseError('当前供应商未配置 API，请先在设置中配置')
      return
    }
    setIsParsing(true)
    setParseError('')
    try {
      const { task_id } = await uploadAndParse(file, {
        type: providerConfig!.active as ProviderType,
        base_url: configured.base_url,
        api_key: configured.api_key,
        model: configured.model,
        template: selectedTemplate,
        title: file.name,
      })
      onClose()
      setIsParsing(false)
      setFile(null)
      setTab('template')
      pendingTaskIdRef.current = task_id
      toast.success('上传成功，简历正在解析中')
    } catch (err: any) {
      setParseError(err.message || '解析失败')
      setIsParsing(false)
    }
  }

  const resetAndClose = () => {
    eventSourceRef.current?.close()
    eventSourceRef.current = null
    onClose()
    setName('')
    setSelectedTemplate('classic')
    setTab('template')
    setFile(null)
    setParseError('')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) handleFileSelect(droppedFile)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  if (!open) return null

  const FileIcon = FileText

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={resetAndClose} />

      <div className="relative w-[896px] h-[720px] bg-[#1c1c1e] border border-[#2a2a2e] rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">新建工作空间</h2>
            <p className="text-gray-400 text-sm mt-1">选择模板或上传简历文件开始创建</p>
          </div>
          <button
            onClick={resetAndClose}
            className="cursor-pointer text-gray-500 hover:text-gray-300 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="mx-6 mt-4 flex gap-1 rounded-lg bg-zinc-800 p-1">
          <button
            type="button"
            className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === 'template'
                ? 'bg-zinc-700 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            onClick={() => setTab('template')}
          >
            从模板创建
          </button>
          <button
            type="button"
            className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === 'upload'
                ? 'bg-zinc-700 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            onClick={() => setTab('upload')}
          >
            上传简历
          </button>
        </div>

        <div className="px-6 py-4 flex-1 flex flex-col overflow-hidden">
          {tab === 'template' ? (
            <div className="flex flex-col h-full space-y-4">
              {/* Name input */}
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入工作空间名称..."
                className="w-full px-4 py-2.5 bg-[#121214] border border-[#2a2a2e] rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 text-sm"
              />

              {/* Template grid */}
              <div className="flex flex-col flex-1 min-h-0">
                <p className="mb-3 text-sm font-medium text-gray-300 shrink-0">
                  选择模板
                </p>
                <div className="flex-1 overflow-y-auto pr-1 min-h-0">
                  <div className="grid grid-cols-5 gap-3">
                    {TEMPLATE_ORDER.map((tpl) => {
                      const isSelected = selectedTemplate === tpl
                      return (
                        <button
                          key={tpl}
                          type="button"
                          className={`relative cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-200 ${
                            isSelected
                              ? 'border-pink-500 shadow-md shadow-pink-500/10'
                              : 'border-zinc-700 hover:border-zinc-600'
                          }`}
                          onClick={() => setSelectedTemplate(tpl)}
                        >
                          {/* Thumbnail */}
                          <div className="relative bg-zinc-800/50 p-2">
                            <TemplateThumbnail
                              template={tpl}
                              className="mx-auto h-[100px] w-[71px] shadow-sm ring-1 ring-zinc-700/50"
                            />
                            {/* Selected check */}
                            {isSelected && (
                              <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-white shadow-sm">
                                <Check className="h-3 w-3" strokeWidth={3} />
                              </div>
                            )}
                          </div>
                          {/* Label */}
                          <div className={`px-2 py-1.5 text-center text-xs font-medium transition-colors ${
                            isSelected
                              ? 'bg-pink-500/10 text-pink-400'
                              : 'text-zinc-400 hover:text-zinc-300'
                          }`}>
                            {templateLabelsMap[tpl]}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full space-y-4">
              {/* Dropzone */}
              <div
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors ${
                  isDragging
                    ? 'border-pink-400 bg-pink-500/10'
                    : file
                      ? 'border-green-500/50 bg-green-500/5'
                      : 'border-zinc-600 hover:border-zinc-500'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                {file ? (
                  <div className="flex items-center gap-3">
                    <FileIcon className="h-8 w-8 text-green-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-200">{file.name}</p>
                      <p className="text-xs text-zinc-500">
                        {(file.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      className="cursor-pointer rounded-full p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
                      onClick={() => setFile(null)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="mb-2 h-8 w-8 text-zinc-500" />
                    <p className="text-sm text-zinc-400">拖拽文件到此处，或点击下方按钮选择</p>
                    <p className="mt-1 text-xs text-zinc-600">支持 PDF（最大 10MB）</p>
                    <button
                      type="button"
                      className="mt-3 cursor-pointer rounded-md bg-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-600 hover:text-zinc-200"
                      onClick={() => {
                        const input = document.createElement('input')
                        input.type = 'file'
                        input.accept = ACCEPTED_EXTENSIONS
                        input.onchange = (e: Event) => {
                          const f = (e.target as HTMLInputElement).files?.[0]
                          if (f) handleFileSelect(f)
                        }
                        input.click()
                      }}
                    >
                      浏览文件
                    </button>
                  </>
                )}
              </div>

              {parseError && (
                <p className="text-sm text-red-400">{parseError}</p>
              )}

              {/* Template selector for upload */}
              <div className="flex flex-col flex-1 min-h-0">
                <p className="mb-3 text-sm font-medium text-gray-300 shrink-0">
                  选择模板
                </p>
                <div className="flex-1 overflow-y-auto pr-1 min-h-0">
                  <div className="grid grid-cols-5 gap-3">
                    {TEMPLATE_ORDER.map((tpl) => {
                      const isSelected = selectedTemplate === tpl
                      return (
                        <button
                          key={tpl}
                          type="button"
                          className={`relative cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-200 ${
                            isSelected
                              ? 'border-pink-500 shadow-md shadow-pink-500/10'
                              : 'border-zinc-700 hover:border-zinc-600'
                          }`}
                          onClick={() => setSelectedTemplate(tpl)}
                        >
                          <div className="relative bg-zinc-800/50 p-2">
                            <TemplateThumbnail
                              template={tpl}
                              className="mx-auto h-[100px] w-[71px] shadow-sm ring-1 ring-zinc-700/50"
                            />
                            {isSelected && (
                              <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-white shadow-sm">
                                <Check className="h-3 w-3" strokeWidth={3} />
                              </div>
                            )}
                          </div>
                          <div className={`px-2 py-1.5 text-center text-xs font-medium transition-colors ${
                            isSelected
                              ? 'bg-pink-500/10 text-pink-400'
                              : 'text-zinc-400 hover:text-zinc-300'
                          }`}>
                            {templateLabelsMap[tpl]}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#2a2a2e]">
          <button
            onClick={resetAndClose}
            className="cursor-pointer px-5 py-2 rounded-lg border border-[#2a2a2e] text-gray-400 hover:text-white hover:border-[#3a3a3c] transition-colors text-sm font-medium"
          >
            取消
          </button>
          {tab === 'template' ? (
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="cursor-pointer px-5 py-2 rounded-lg bg-pink-500 text-white hover:bg-pink-600 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  创建中...
                </>
              ) : (
                '创建'
              )}
            </button>
          ) : (
            <button
              onClick={handleUploadParse}
              disabled={!file || isParsing}
              className="cursor-pointer px-5 py-2 rounded-lg bg-pink-500 text-white hover:bg-pink-600 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
            >
              {isParsing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  解析中...
                </>
              ) : (
                '上传并解析'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
