import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  SkipForward,
  Lightbulb,
  StopCircle,
  Send,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Loader2,
  Play,
  ChevronDown,
  ChevronRight,
  Brain,
  Inbox,
  FileX,
} from 'lucide-react';
import { toast } from 'sonner';
import { useInterviewStore } from '@/stores/interview-store';
import {
  streamInterviewChat,
  getProviderConfig,
  getConversationMessages,
  fetchWorkspaces,
  fetchResumeDetail,
  regenerateRoundSummary,
  checkRunningInterviewSummaryTask,
} from '@/lib/api';
import { addNotificationTask, markUnread } from '@/lib/notification';
import type { InterviewRound, InterviewChatAction } from '@/types/interview';
import type { SSEEvent, ProviderConfig, ConversationMessage as ApiConversationMessage } from '@/lib/api';

const SKIP_MARKERS = ['<INTERVIEW_START>', '<SKIP>', '<HINT>'];

interface Message {
  id: string;
  role: 'interviewer' | 'candidate';
  content: string;
  reasoning: string | null;
  timestamp: Date;
}

interface StreamingState {
  content: string;
  thinking: string;
  thinkingVisible: boolean;
  isThinking: boolean;
  isActive: boolean;
}

function apiMessagesToLocal(messages: ApiConversationMessage[]): Message[] {
  const result: Message[] = [];
  for (const msg of messages) {
    let text = '';
    for (const block of msg.content) {
      if (block.type === 'text') {
        text += block.text;
      }
    }
    if (SKIP_MARKERS.includes(text.trim())) continue;
    result.push({
      id: `db-${msg.id}`,
      role: msg.role === 'user' ? 'candidate' : 'interviewer',
      content: text,
      reasoning: msg.reasoning || null,
      timestamp: msg.createdAt ? new Date(msg.createdAt) : new Date(),
    });
  }
  return result;
}

export default function InterviewPage() {
  const { workspaceId, resumeId, collectionId, roundId } = useParams<{
    workspaceId: string;
    resumeId: string;
    collectionId: string;
    roundId: string;
  }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoStart = searchParams.get('autoStart') === '1';

  const backUrl = workspaceId && resumeId
    ? `/workspace/${workspaceId}/resumes/${resumeId}/interview${collectionId ? `?activate=${collectionId}` : ''}`
    : workspaceId
      ? `/workspace/${workspaceId}`
      : '/workspace';

  const getCollectionById = useInterviewStore((s) => s.getCollectionById);
  const updateRoundStatus = useInterviewStore((s) => s.updateRoundStatus);

  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isEnding, setIsEnding] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryTaskId, setSummaryTaskId] = useState<string | null>(null);
  const [localStarted, setLocalStarted] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [providerConfig, setProviderConfig] = useState<ProviderConfig | null>(null);
  const [streaming, setStreaming] = useState<StreamingState>({
    content: '',
    thinking: '',
    thinkingVisible: false,
    isThinking: false,
    isActive: false,
  });
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());
  const streamingRef = useRef<StreamingState>({
    content: '',
    thinking: '',
    thinkingVisible: false,
    isThinking: false,
    isActive: false,
  });
  const cleanupRef = useRef<(() => void) | null>(null);
  const isDoneRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchCollections = useInterviewStore((s) => s.fetchCollections)
  const [workspaceNotFound, setWorkspaceNotFound] = useState(false)
  const [resumeNotFound, setResumeNotFound] = useState(false)
  const [collectionNotFound, setCollectionNotFound] = useState(false)

  useEffect(() => {
    if (!workspaceId || !resumeId || !collectionId || !roundId) {
      setLoading(false)
      return
    }

    Promise.all([
      fetchWorkspaces().catch(() => null),
      fetchResumeDetail(workspaceId).catch(() => null),
    ])
      .then(async ([workspaces, resumeData]) => {
        const ws = (workspaces as any[])?.find((w: any) => w.id === workspaceId)
        if (!ws) {
          setWorkspaceNotFound(true)
          return
        }

        const subResumes = (resumeData as any)?.subResumes || []
        const subResume = subResumes.find((s: any) => s.id === resumeId)
        if (!subResume) {
          setResumeNotFound(true)
          return
        }

        await fetchCollections(resumeId)
        const col = useInterviewStore.getState().getCollectionById(collectionId)
        if (!col) {
          setCollectionNotFound(true)
          return
        }
      })
      .catch(() => {
        setCollectionNotFound(true)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [workspaceId, resumeId, collectionId, roundId, fetchCollections])

  const collection = collectionId ? getCollectionById(collectionId) : null;
  const rounds = collection?.rounds || [];
  const sortedRounds = [...rounds].sort((a, b) => a.sortOrder - b.sortOrder);
  const currentRound = sortedRounds.find((r) => r.id === roundId);
  const currentRoundIndex = sortedRounds.findIndex((r) => r.id === roundId);
  const initialStarted = currentRound ? currentRound.status !== 'not_started' : false;
  const hasStarted = initialStarted || localStarted;
  const isCompleted = currentRound?.status === 'completed';

  const configValidation = useMemo(() => {
    if (!providerConfig) {
      return { valid: false, message: '正在加载 AI 配置...', isLoaded: false };
    }
    const active = providerConfig.active;
    const cfg = providerConfig.providers[active];
    if (!cfg) {
      return { valid: false, message: `未找到激活的 Provider '${active}' 配置`, isLoaded: true };
    }
    const missing: string[] = [];
    if (!cfg.model?.trim()) missing.push('Model');
    if (!cfg.apiKey?.trim()) missing.push('API Key');
    if (!cfg.baseUrl?.trim()) missing.push('Base URL');
    if (missing.length > 0) {
      return { valid: false, message: `AI 配置不完整，缺少: ${missing.join('、')}`, isLoaded: true };
    }
    return { valid: true, message: '配置就绪', isLoaded: true };
  }, [providerConfig]);

  interface RoundSummary {
    overall_assessment: string;
    strengths: string[];
    weaknesses: string[];
    score: number;
    generated_at: string;
  }

  const roundSummary = useMemo(
    () => (currentRound?.metaInfo as Record<string, unknown> | undefined)?.round_summary as RoundSummary | undefined,
    [currentRound?.metaInfo],
  );

  const answeredCount = useMemo(() => messages.filter((m) => m.role === 'candidate').length, [messages]);

  useEffect(() => {
    getProviderConfig()
      .then(setProviderConfig)
      .catch(() => toast.error('加载 AI 配置失败'));
  }, []);

  useEffect(() => {
    if (hasStarted && roundId) {
      getConversationMessages(roundId)
        .then((apiMsgs) => {
          setMessages(apiMessagesToLocal(apiMsgs));
        })
        .catch(() => { });
    }
  }, [hasStarted, roundId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming.content, streaming.thinking]);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const getApiParams = useCallback(
    (action: InterviewChatAction, content?: string) => {
      if (!providerConfig || !roundId) return null;
      const active = providerConfig.active;
      const cfg = providerConfig.providers[active];
      return {
        roundId,
        action,
        content,
        model: cfg.model,
        type: active,
        apiKey: cfg.apiKey,
        baseUrl: cfg.baseUrl,
      };
    },
    [providerConfig, roundId],
  );

  const handleSSEEvent = useCallback(
    (event: SSEEvent) => {
      const ref = streamingRef;

      switch (event.type) {
        case 'next':
          ref.current = { content: '', thinking: '', thinkingVisible: false, isThinking: false, isActive: false };
          setStreaming({ content: '', thinking: '', thinkingVisible: false, isThinking: false, isActive: false });
          break;

        case 'thinking_start':
          ref.current = { ...ref.current, thinking: '', thinkingVisible: false, isThinking: true };
          setStreaming({ ...ref.current });
          break;

        case 'thinking_delta': {
          const text = (event.data.text as string) || '';
          ref.current = {
            ...ref.current,
            thinking: ref.current.thinking + text,
          };
          setStreaming({ ...ref.current });
          break;
        }

        case 'text_start':
          ref.current = { ...ref.current, content: '', thinkingVisible: false, isThinking: false, isActive: true };
          setStreaming({ ...ref.current });
          break;

        case 'text_delta': {
          const text = (event.data.text as string) || '';
          ref.current = { ...ref.current, content: ref.current.content + text };
          setStreaming({ ...ref.current });
          break;
        }

        case 'done': {
          if (isDoneRef.current) break;
          isDoneRef.current = true;

          const finalContent = ref.current.content;
          const finalThinking = ref.current.thinking;

          ref.current = { content: '', thinking: '', thinkingVisible: false, isThinking: false, isActive: false };
          setStreaming({ content: '', thinking: '', thinkingVisible: false, isThinking: false, isActive: false });
          setIsStreaming(false);
          cleanupRef.current?.();

          if (finalContent) {
            const msg: Message = {
              id: `interviewer-${Date.now()}`,
              role: 'interviewer',
              content: finalContent,
              reasoning: finalThinking || null,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, msg]);
          }
          break;
        }

        case 'error': {
          const msg = (event.data.message as string) || '未知错误';
          toast.error(msg);
          ref.current = { content: '', thinking: '', thinkingVisible: false, isThinking: false, isActive: false };
          setStreaming({ content: '', thinking: '', thinkingVisible: false, isThinking: false, isActive: false });
          setIsStreaming(false);
          cleanupRef.current?.();
          break;
        }
      }
    },
    [],
  );

  const doChat = useCallback(
    (action: InterviewChatAction, content?: string) => {
      const params = getApiParams(action, content);
      if (!params) {
        toast.error('AI 配置未加载');
        return;
      }

      cleanupRef.current?.();
      isDoneRef.current = false;
      setIsStreaming(true);

      streamingRef.current = {
        content: '',
        thinking: '',
        thinkingVisible: false,
        isThinking: false,
        isActive: false,
      };
      setStreaming({
        content: '',
        thinking: '',
        thinkingVisible: false,
        isThinking: false,
        isActive: false,
      });

      const { cleanup } = streamInterviewChat(params, handleSSEEvent);
      cleanupRef.current = cleanup;
    },
    [getApiParams, handleSSEEvent],
  );

  const handleStart = () => {
    if (!roundId || !collectionId) return;
    setLocalStarted(true);
    doChat('start');
  };

  const autoStartTriggered = useRef(false);
  useEffect(() => {
    if (
      autoStart &&
      !autoStartTriggered.current &&
      !loading &&
      currentRound &&
      !hasStarted &&
      configValidation.valid
    ) {
      autoStartTriggered.current = true;
      handleStart();
    }
  }, [autoStart, loading, currentRound, hasStarted, configValidation]);

  const handleSend = () => {
    if (!inputValue.trim() || isStreaming) return;
    const candidateMsg: Message = {
      id: `candidate-${Date.now()}`,
      role: 'candidate',
      content: inputValue.trim(),
      reasoning: null,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, candidateMsg]);
    const answer = inputValue.trim();
    setInputValue('');
    doChat('answer', answer);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSkip = () => {
    if (isStreaming) return;
    doChat('skip');
  };

  const handleHint = () => {
    if (isStreaming) return;
    doChat('hint');
  };

  const handleEndRound = async () => {
    if (!collectionId || !roundId || !providerConfig) return;
    setIsEnding(true);
    try {
      cleanupRef.current?.();

      await updateRoundStatus(collectionId, roundId, 'completed');

      const active = providerConfig.active;
      const cfg = providerConfig.providers[active];
      const { taskId } = await regenerateRoundSummary({
        roundId,
        type: active,
        apiKey: cfg.apiKey,
        baseUrl: cfg.baseUrl,
        model: cfg.model,
      });

      markUnread();
      addNotificationTask({
        id: taskId,
        taskType: 'interview_summary',
        status: 'running',
        metaInfo: {
          title: currentRound?.name || '',
          fileName: roundId,
        },
        errorMessage: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const nextRound = sortedRounds[currentRoundIndex + 1];
      if (nextRound) {
        toast.success('本轮面试已结束，正在生成总结...');
        navigate(
          `/workspace/${workspaceId}/resumes/${resumeId}/interview/${collectionId}/${nextRound.id}?autoStart=1`,
        );
      } else {
        toast.success('面试全部完成');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '结束面试失败');
    } finally {
      setIsEnding(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!roundId || !providerConfig) return;

    const existing = await checkRunningInterviewSummaryTask(roundId);
    if (existing) {
      setSummaryTaskId(existing.taskId);
      toast.error('该轮次已有正在进行的摘要生成任务');
      return;
    }

    setIsGeneratingSummary(true);
    try {
      const active = providerConfig.active;
      const cfg = providerConfig.providers[active];
      const { taskId } = await regenerateRoundSummary({
        roundId,
        type: active,
        apiKey: cfg.apiKey,
        baseUrl: cfg.baseUrl,
        model: cfg.model,
      });

      markUnread();
      addNotificationTask({
        id: taskId,
        taskType: 'interview_summary',
        status: 'running',
        metaInfo: {
          title: currentRound?.name || '',
          fileName: roundId,
        },
        errorMessage: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setSummaryTaskId(taskId);
      toast.success('摘要生成已开始');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '生成摘要失败');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleRoundClick = (round: InterviewRound) => {
    if (round.id === roundId) return;
    if (round.status === 'completed' || round.status === 'in_progress') {
      navigate(`/workspace/${workspaceId}/resumes/${resumeId}/interview/${collectionId}/${round.id}`);
    }
  };

  const toggleReasoning = (msgId: string) => {
    setExpandedReasoning((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  };

  if (workspaceNotFound) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#131313]">
        <div className="flex flex-col items-center justify-center text-gray-400 gap-4">
          <Inbox className="w-16 h-16 text-gray-500/40" strokeWidth={1.5} />
          <div className="text-center">
            <p className="text-lg text-gray-300 mb-1">工作空间不存在</p>
            <p className="text-sm text-gray-500">访问的工作空间可能已被删除或不存在</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/workspace')}
            className="mt-2 px-4 py-2 rounded-lg bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 transition-colors text-sm"
          >
            返回工作空间列表
          </button>
        </div>
      </div>
    )
  }

  if (resumeNotFound) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#131313]">
        <div className="flex flex-col items-center justify-center text-gray-400 gap-4">
          <FileX className="w-16 h-16 text-gray-500/40" strokeWidth={1.5} />
          <div className="text-center">
            <p className="text-lg text-gray-300 mb-1">子简历不存在</p>
            <p className="text-sm text-gray-500">访问的子简历可能已被删除或不存在</p>
          </div>
          <button
            type="button"
            onClick={() => workspaceId ? navigate(`/workspace/${workspaceId}`) : navigate('/workspace')}
            className="mt-2 px-4 py-2 rounded-lg bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 transition-colors text-sm"
          >
            返回工作空间详情
          </button>
        </div>
      </div>
    )
  }

  if (collectionNotFound) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#131313]">
        <div className="flex flex-col items-center justify-center text-gray-400 gap-4">
          <Circle className="w-16 h-16 text-gray-500/40" strokeWidth={1.5} />
          <div className="text-center">
            <p className="text-lg text-gray-300 mb-1">面试方案不存在</p>
            <p className="text-sm text-gray-500">该面试方案可能已被删除或不存在</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/workspace/${workspaceId}/resumes/${resumeId}/interview`)}
            className="mt-2 px-4 py-2 rounded-lg bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 transition-colors text-sm"
          >
            返回面试方案列表
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#131313]">
        <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
      </div>
    );
  }

  if (!currentRound || !collection) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#131313]">
        <div className="flex flex-col items-center justify-center text-gray-400 gap-4">
          <Circle className="w-16 h-16 text-gray-500/40" strokeWidth={1.5} />
          <div className="text-center">
            <p className="text-lg text-gray-300 mb-1">面试轮次不存在</p>
            <p className="text-sm text-gray-500">该面试轮次可能已被删除或不存在</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(backUrl)}
            className="mt-2 px-4 py-2 rounded-lg bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 transition-colors text-sm"
          >
            返回工作空间
          </button>
        </div>
      </div>
    );
  }

  const getInterviewerInitial = (name: string) => name.charAt(0);

  if (!hasStarted) {
    return (
      <div className="flex h-screen flex-col bg-[#131313] text-foreground overflow-hidden">
        <div className="shrink-0 px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(backUrl)}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-muted-foreground">{collection.name}</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-6 max-w-md text-center px-6">
            <div className="w-16 h-16 rounded-full bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-xl font-bold text-pink-400">
              {getInterviewerInitial(currentRound.interviewerName)}
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-1">{currentRound.name}</h2>
              <p className="text-sm text-muted-foreground">
                {currentRound.interviewerName}
                {currentRound.interviewerTitle ? ` · ${currentRound.interviewerTitle}` : ''}
              </p>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {currentRound.interviewerBio || '准备好开始面试了吗？点击下方按钮开始。'}
            </p>
            {configValidation.isLoaded && !configValidation.valid && (
              <div className="w-full px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-left">
                <p className="text-sm text-yellow-400">{configValidation.message}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  请前往设置页面完善 AI 配置后再开始面试
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={handleStart}
              disabled={!providerConfig || (configValidation.isLoaded && !configValidation.valid)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              {!providerConfig
                ? '加载配置中...'
                : configValidation.valid
                  ? '开始面试'
                  : '配置未就绪'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-[#131313] text-foreground overflow-hidden">
      {/* Header: back button + round stepper */}
      <div className="shrink-0 px-6 py-3 border-b border-white/5 min-h-[52px] flex items-center">
        <div className="flex items-center gap-3 w-full">
          <button
            type="button"
            onClick={() => navigate(backUrl)}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-muted-foreground shrink-0">{collection.name}</span>
          <div className="flex items-center gap-0 overflow-x-auto flex-1 justify-center">
            {sortedRounds.map((round, index) => (
              <div key={round.id} className="flex items-center shrink-0">
                {index > 0 && (
                  <div className={`w-6 h-[2px] mx-1 ${
                    sortedRounds[index - 1].status === 'completed'
                      ? 'bg-green-500/40'
                      : 'bg-white/10'
                  }`} />
                )}
                <button
                  type="button"
                  onClick={() => handleRoundClick(round)}
                  disabled={round.status !== 'completed' && round.status !== 'in_progress' && round.id !== roundId}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium shrink-0 border-2 ${
                    round.id === roundId
                      ? 'bg-pink-500/20 text-pink-400 border-pink-500'
                      : round.status === 'completed'
                        ? 'bg-green-500/10 text-green-400 border-green-500 hover:bg-green-500/15'
                        : round.status === 'in_progress'
                          ? 'bg-white/[0.08] text-foreground border-white/15 hover:bg-white/[0.12]'
                          : 'bg-white/[0.05] text-muted-foreground border-white/10 opacity-50'
                  }`}
                >
                  {round.status === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold align-super ${
                      round.id === roundId
                        ? 'bg-pink-500 text-white'
                        : 'bg-white/10 text-muted-foreground'
                    }`}>
                      {index + 1}
                    </span>
                  )}
                  <span className="whitespace-nowrap">{round.interviewerName || `第${index + 1}轮`}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {!isCompleted && (
        <div className="shrink-0 px-6 py-2">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-xl border border-pink-500/20 bg-pink-500/[0.03] p-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-pink-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {getInterviewerInitial(currentRound.interviewerName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold">{currentRound.interviewerName}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/10 text-muted-foreground">
                      {currentRound.name}
                    </span>
                  </div>
                  {currentRound.interviewerBio && (
                    <p className="text-[10px] text-muted-foreground line-clamp-1">
                      {currentRound.interviewerBio}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-pink-400">
                    {answeredCount}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    已答
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
      }

      <div className="flex-1 overflow-hidden min-h-0">
        {isCompleted ? (
          <div className="flex h-full">
            <div className="w-[380px] shrink-0 overflow-y-auto border-r border-white/5 p-4">
              {roundSummary ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-green-400">面试总结</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(roundSummary.generated_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">综合评分</span>
                    <span className="text-lg font-bold text-pink-400">{roundSummary.score}</span>
                    <span className="text-[10px] text-muted-foreground">/ 100</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {roundSummary.overall_assessment}
                  </p>
                  {roundSummary.strengths.length > 0 && (
                    <div>
                      <span className="text-[10px] text-green-400 font-medium">优势</span>
                      <ul className="mt-1 space-y-0.5">
                        {roundSummary.strengths.map((s, i) => (
                          <li key={i} className="text-[10px] text-muted-foreground">· {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {roundSummary.weaknesses.length > 0 && (
                    <div>
                      <span className="text-[10px] text-yellow-400 font-medium">待改进</span>
                      <ul className="mt-1 space-y-0.5">
                        {roundSummary.weaknesses.map((w, i) => (
                          <li key={i} className="text-[10px] text-muted-foreground">· {w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : summaryTaskId ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8">
                  <Loader2 className="w-5 h-5 text-pink-400 animate-spin" />
                  <span className="text-xs text-muted-foreground">摘要生成中...</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateSummary}
                  disabled={isGeneratingSummary}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs hover:bg-pink-500/20 transition-colors disabled:opacity-50"
                >
                  {isGeneratingSummary ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Brain className="w-3.5 h-3.5" />
                  )}
                  {isGeneratingSummary ? '创建中...' : '生成总结'}
                </button>
              )}
            </div>
            <div className="flex-1 flex flex-col min-w-0">
              <div className="shrink-0 px-4 py-2">
                <div className="rounded-xl border border-pink-500/20 bg-pink-500/[0.03] p-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-pink-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {getInterviewerInitial(currentRound.interviewerName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold">{currentRound.interviewerName}</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/10 text-muted-foreground">
                          {currentRound.name}
                        </span>
                      </div>
                      {currentRound.interviewerBio && (
                        <p className="text-[10px] text-muted-foreground line-clamp-1">
                          {currentRound.interviewerBio}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-pink-400">
                        {answeredCount}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        已答
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="space-y-4">


                  <div className="max-w-3xl mx-auto space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === 'candidate' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] px-4 py-3 text-sm leading-relaxed ${msg.role === 'candidate'
                            ? 'bg-pink-500/10 border border-pink-500/20 text-foreground rounded-xl'
                            : 'bg-white/[0.04] border-l-4 border-l-pink-500/60 text-foreground rounded-r-xl'
                            }`}
                        >
                          {msg.reasoning && (
                            <div className="mb-2">
                              <button
                                type="button"
                                onClick={() => toggleReasoning(msg.id)}
                                className="flex items-center gap-1 text-[10px] text-muted-foreground"
                              >
                                {expandedReasoning.has(msg.id) ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                                <span className="italic flex items-center gap-1">
                                  <Brain className="h-3 w-3" /> 思考过程
                                </span>
                              </button>
                              {expandedReasoning.has(msg.id) && (
                                <div className="text-[10px] text-muted-foreground pl-4 border-l border-border whitespace-pre-wrap mt-1">
                                  {msg.reasoning}
                                </div>
                              )}
                            </div>
                          )}
                          {msg.content.split('\n').map((line, i) => (
                            <p key={i} className={i > 0 ? 'mt-2' : ''}>
                              {line}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full">
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="max-w-3xl mx-auto space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'candidate' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-3 text-sm leading-relaxed ${msg.role === 'candidate'
                        ? 'bg-pink-500/10 border border-pink-500/20 text-foreground rounded-xl'
                        : 'bg-white/[0.04] border-l-4 border-l-pink-500/60 text-foreground rounded-r-xl'
                        }`}
                    >
                      {msg.reasoning && (
                        <div className="mb-2">
                          <button
                            type="button"
                            onClick={() => toggleReasoning(msg.id)}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground"
                          >
                            {expandedReasoning.has(msg.id) ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                            <span className="italic flex items-center gap-1">
                              <Brain className="h-3 w-3" /> 思考过程
                            </span>
                          </button>
                          {expandedReasoning.has(msg.id) && (
                            <div className="text-[10px] text-muted-foreground pl-4 border-l border-border whitespace-pre-wrap mt-1">
                              {msg.reasoning}
                            </div>
                          )}
                        </div>
                      )}
                      {msg.content.split('\n').map((line, i) => (
                        <p key={i} className={i > 0 ? 'mt-2' : ''}>
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}

                {isStreaming && streaming.thinking && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] px-4 py-3 bg-white/[0.04] border-l-4 border-l-pink-500/60 text-foreground rounded-r-xl">
                      <button
                        type="button"
                        onClick={() => {
                          streamingRef.current = {
                            ...streamingRef.current,
                            thinkingVisible: !streamingRef.current.thinkingVisible,
                          };
                          setStreaming({ ...streamingRef.current });
                        }}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground"
                      >
                        {streaming.thinkingVisible ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        <span className="italic flex items-center gap-1">
                          <Brain className="h-3 w-3" /> 思考过程
                        </span>
                        {streaming.isThinking && (
                          <span className="flex gap-0.5 ml-1">
                            <span className="w-1 h-1 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1 h-1 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '120ms' }} />
                            <span className="w-1 h-1 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '240ms' }} />
                          </span>
                        )}
                      </button>
                      {streaming.thinkingVisible && (
                        <div className="text-[10px] text-muted-foreground pl-4 border-l border-border whitespace-pre-wrap mt-1">
                          {streaming.thinking}
                        </div>
                      )}
                      {streaming.content && (
                        <div className="text-sm leading-relaxed mt-2">
                          {streaming.content.split('\n').map((line, i) => (
                            <p key={i} className={i > 0 ? 'mt-2' : ''}>
                              {line}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {isStreaming && !streaming.thinking && streaming.content && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] px-4 py-3 text-sm leading-relaxed bg-white/[0.04] border-l-4 border-l-pink-500/60 text-foreground rounded-r-xl">
                      {streaming.content.split('\n').map((line, i) => (
                        <p key={i} className={i > 0 ? 'mt-2' : ''}>
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {isStreaming && !streaming.content && !streaming.thinking && (
                  <div className="flex justify-start">
                    <div className="px-4 py-3 bg-white/[0.04] border-l-4 border-l-pink-500/60 rounded-r-xl">
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce [animation-delay:300ms]" />
                      </span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>
        )}
      </div>

      {!isCompleted && (
        <div className="shrink-0 px-6 py-3 border-t border-white/5">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSkip}
                disabled={isStreaming || isCompleted}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SkipForward className="w-3.5 h-3.5" />
                跳过
              </button>
              <button
                type="button"
                onClick={handleHint}
                disabled={isStreaming || isCompleted}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Lightbulb className="w-3.5 h-3.5" />
                请求提示
              </button>
            </div>

            <button
              type="button"
              onClick={handleEndRound}
              disabled={isEnding || isStreaming || answeredCount === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              <StopCircle className="w-3.5 h-3.5" />
              {isEnding ? '结束中...' : '结束本轮'}
            </button>
          </div>
        </div>
      )}

      {!isCompleted && (
        <div className="shrink-0 px-6 pb-6 pt-2">
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-col rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden min-h-[98px] focus-within:border-pink-500/30 transition-colors">
              <div className="flex-1 overflow-y-auto px-4 pt-3">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入你的回答..."
                  disabled={isStreaming}
                  rows={3}
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground border-none focus:outline-none resize-none"
                />
              </div>
              <div className="flex items-center justify-between px-4 pb-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{providerConfig?.providers[providerConfig.active]?.model || ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isStreaming}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-500 text-white hover:bg-pink-600 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isStreaming ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
