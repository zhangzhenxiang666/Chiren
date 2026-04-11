import { useState } from 'react';
import { Palette, Type, Space, ChevronDown, ChevronRight, RotateCcw, LayoutGrid } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useResumeStore } from '@/stores/resume-store';
import type { ThemeConfig } from '@/types/resume';
import { TEMPLATES } from '@/lib/constants';
import { TemplateThumbnail } from '../template/TemplateThumbnail';

const DEFAULT_THEME: ThemeConfig = {
  primaryColor: '#1a1a1a',
  accentColor: '#3b82f6',
  fontFamily: 'Inter',
  fontSize: 'medium',
  lineSpacing: 1.5,
  margin: { top: 20, right: 20, bottom: 20, left: 20 },
  sectionSpacing: 16,
  avatarStyle: 'oneInch',
};

const PRESET_THEMES = [
  { id: 'classic', colors: ['#1a1a1a', '#3b82f6', '#ffffff', '#374151'], config: { primaryColor: '#1a1a1a', accentColor: '#3b82f6', fontFamily: 'Georgia', fontSize: 'medium' as const, lineSpacing: 1.5, margin: { top: 24, right: 24, bottom: 24, left: 24 }, sectionSpacing: 16 } },
  { id: 'modern', colors: ['#0f172a', '#6366f1', '#f8fafc', '#475569'], config: { primaryColor: '#0f172a', accentColor: '#6366f1', fontFamily: 'Inter', fontSize: 'medium' as const, lineSpacing: 1.6, margin: { top: 20, right: 20, bottom: 20, left: 20 }, sectionSpacing: 14 } },
  { id: 'minimal', colors: ['#27272a', '#a1a1aa', '#ffffff', '#52525b'], config: { primaryColor: '#27272a', accentColor: '#a1a1aa', fontFamily: 'Helvetica', fontSize: 'small' as const, lineSpacing: 1.4, margin: { top: 28, right: 28, bottom: 28, left: 28 }, sectionSpacing: 12 } },
];

const FONT_OPTIONS = ['Inter', 'Georgia', 'Helvetica', 'Arial', 'Palatino', 'Verdana'];

function CollapsibleSection({ title, icon: Icon, children, defaultOpen = true }: { title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full cursor-pointer items-center gap-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300">
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Icon className="h-3.5 w-3.5" />
        <span>{title}</span>
      </button>
      {open && <div className="space-y-3 pb-3 pl-5">{children}</div>}
    </div>
  );
}

export function ThemeEditor() {
  const { currentResume } = useResumeStore();
  const themeConfig: ThemeConfig = { ...DEFAULT_THEME, ...(currentResume?.themeConfig || {}) };
  const updateTheme = (updates: Partial<ThemeConfig>) => {
    if (!currentResume) return;
    useResumeStore.getState().updateSectionTitle;
    useResumeStore.setState((state) => ({
      currentResume: state.currentResume ? { ...state.currentResume, themeConfig: { ...themeConfig, ...updates } } : null,
      isDirty: true,
    }));
  };

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-l bg-white dark:bg-zinc-900 dark:border-zinc-800">
      <div className="flex items-center justify-between border-b px-4 py-3 dark:border-zinc-800">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <Palette className="h-4 w-4 text-zinc-500" />
          主题
        </h3>
        <button type="button" onClick={() => updateTheme(DEFAULT_THEME)} className="cursor-pointer rounded p-1 text-zinc-400 hover:text-zinc-600">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 py-3 space-y-1">
          <CollapsibleSection title="模板" icon={LayoutGrid}>
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  className={`group/tpl cursor-pointer overflow-hidden rounded-lg border-2 transition-all ${currentResume?.template === tpl ? 'border-pink-500 shadow-sm' : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700'}`}
                  onClick={() => useResumeStore.getState().setTemplate(tpl)}
                >
                  <div className="bg-zinc-50 p-1 dark:bg-zinc-800/50">
                    <TemplateThumbnail template={tpl} className="mx-auto h-8 w-[22px] shadow-sm ring-1 ring-zinc-200/50" />
                  </div>
                  <div className={`truncate px-1 py-0.5 text-center text-[10px] font-medium ${currentResume?.template === tpl ? 'bg-pink-50 text-pink-700' : 'text-zinc-500'}`}>{tpl}</div>
                </button>
              ))}
            </div>
          </CollapsibleSection>
          <Separator />
          <CollapsibleSection title="预设主题" icon={Palette as React.ElementType}>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_THEMES.map((preset) => (
                <button key={preset.id} type="button" onClick={() => updateTheme(preset.config)} className="group flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-zinc-200 p-2 transition-all hover:border-zinc-400 hover:shadow-sm dark:border-zinc-700">
                  <div className="flex gap-0.5">{preset.colors.map((color) => <div key={color} className="h-3 w-3 rounded-full border border-zinc-200" style={{ backgroundColor: color }} />)}</div>
                  <span className="text-[10px] text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-200">{preset.id}</span>
                </button>
              ))}
            </div>
          </CollapsibleSection>
          <Separator />
          <CollapsibleSection title="颜色" icon={Palette as React.ElementType}>
            <div className="space-y-2">
              <ColorPicker label="主色" value={themeConfig.primaryColor} onChange={(c) => updateTheme({ primaryColor: c })} />
              <ColorPicker label="强调色" value={themeConfig.accentColor} onChange={(c) => updateTheme({ accentColor: c })} />
            </div>
          </CollapsibleSection>
          <Separator />
          <CollapsibleSection title="排版" icon={Type as React.ElementType}>
            <label className="block text-xs text-zinc-500">字体
              <select
                value={themeConfig.fontFamily}
                onChange={(e) => updateTheme({ fontFamily: e.target.value })}
                className="mt-1 w-full rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800/50 focus.border-pink-300 focus:outline-none"
              >
                {FONT_OPTIONS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
              </select>
            </label>
            <label className="block text-xs text-zinc-500">行距
              <input type="range" min={1.0} max={2.5} step={0.1} value={themeConfig.lineSpacing} onChange={(e) => updateTheme({ lineSpacing: Number(e.target.value) })} className="mt-1 w-full" />
              <span className="text-xs text-zinc-400">{themeConfig.lineSpacing.toFixed(1)}</span>
            </label>
          </CollapsibleSection>
          <Separator />
          <CollapsibleSection title="间距" icon={Space as React.ElementType}>
            <label className="block text-xs text-zinc-500">段落间距
              <input type="range" min={4} max={32} step={2} value={themeConfig.sectionSpacing} onChange={(e) => updateTheme({ sectionSpacing: Number(e.target.value) })} className="mt-1 w-full" />
              <span className="text-xs text-zinc-400">{themeConfig.sectionSpacing}px</span>
            </label>
          </CollapsibleSection>
        </div>
      </ScrollArea>
    </div>
  );
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-zinc-600 dark:text-zinc-400">{label}</span>
      <div className="flex items-center gap-2 rounded-md border border-zinc-200 px-2 py-1 dark:border-zinc-700">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-4 w-4 cursor-pointer rounded border-0 p-0" />
        <span className="font-mono text-xs text-zinc-500">{value}</span>
      </div>
    </div>
  );
}
