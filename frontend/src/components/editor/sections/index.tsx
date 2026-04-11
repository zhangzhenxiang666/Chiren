import { useState } from 'react';
import type { SectionComponentProps } from './helpers';
import { F, S, TA, c, makeId, YearMonthPicker } from './helpers';

const degreeOptions = ['初中', '高中', '中专', '大专', '本科', '学士', '硕士', '博士', '博士后'];

export function WorkExperience({ section, onUpdate }: SectionComponentProps) {
  const d = c(section);
  const items: any[] = d.items || [];
  const updateItem = (idx: number, field: string, value: any) => {
    const n = [...items]; n[idx] = { ...n[idx], [field]: value }; onUpdate({ items: n });
  };
  const addItem = () => onUpdate({ items: [...items, { id: makeId(), company: '', position: '', location: '', startDate: '', endDate: null, current: false, description: '', technologies: [], highlights: [] }] });
  const removeItem = (idx: number) => onUpdate({ items: items.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="space-y-3 rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <F label="公司名称" value={item.company || ''} onChange={(e) => updateItem(items.indexOf(item), 'company', e.target.value)} />
            <F label="职位" value={item.position || ''} onChange={(e) => updateItem(items.indexOf(item), 'position', e.target.value)} />
            <YearMonthPicker label="开始日期" value={item.startDate || ''} onChange={(v) => updateItem(items.indexOf(item), 'startDate', v)} />
            <YearMonthPicker label="结束日期" value={item.endDate || ''} onChange={(v) => updateItem(items.indexOf(item), 'endDate', v)} />
          </div>
          <TA label="描述" value={item.description || ''} onChange={(e) => updateItem(items.indexOf(item), 'description', e.target.value)} rows={2} />
          <div className="flex justify-end">
            <button type="button" onClick={() => removeItem(items.indexOf(item))} className="text-xs text-zinc-400 hover:text-red-500 transition-colors">删除</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={addItem} className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors">
        <span className="text-lg leading-none">+</span> 添加经历
      </button>
    </div>
  );
}

export function Education({ section, onUpdate }: SectionComponentProps) {
  const d = c(section);
  const items: any[] = d.items || [];
  const updateItem = (idx: number, field: string, value: any) => {
    const n = [...items]; n[idx] = { ...n[idx], [field]: value }; onUpdate({ items: n });
  };
  const addItem = () => onUpdate({ items: [...items, { id: makeId(), institution: '', degree: '', field: '', location: '', startDate: '', endDate: '', gpa: '', highlights: [] }] });
  const removeItem = (idx: number) => onUpdate({ items: items.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="space-y-3 rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <F label="学校" value={item.institution || ''} onChange={(e) => updateItem(items.indexOf(item), 'institution', e.target.value)} />
            <S label="学位" value={item.degree || ''} options={degreeOptions} onChange={(v) => updateItem(items.indexOf(item), 'degree', v)} />
            <F label="专业" value={item.field || ''} onChange={(e) => updateItem(items.indexOf(item), 'field', e.target.value)} />
            <F label="GPA" value={item.gpa || ''} onChange={(e) => updateItem(items.indexOf(item), 'gpa', e.target.value)} />
            <YearMonthPicker label="入学时间" value={item.startDate || ''} onChange={(v) => updateItem(items.indexOf(item), 'startDate', v)} />
            <YearMonthPicker label="毕业时间" value={item.endDate || ''} onChange={(v) => updateItem(items.indexOf(item), 'endDate', v)} />
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={() => removeItem(items.indexOf(item))} className="text-xs text-zinc-400 hover:text-red-500 transition-colors">删除</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={addItem} className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors">
        <span className="text-lg leading-none">+</span> 添加教育经历
      </button>
    </div>
  );
}

export function Skills({ section, onUpdate }: SectionComponentProps) {
  const d = c(section);
  const categories: Array<{ id: string; name: string; skills: string[] }> = d.categories || [];
  const updateCategory = (idx: number, updates: any) => {
    const n = [...categories]; n[idx] = { ...n[idx], ...updates }; onUpdate({ categories: n });
  };
  const addCategory = () => onUpdate({ categories: [...categories, { id: makeId(), name: '', skills: [] }] });
  const removeCategory = (idx: number) => onUpdate({ categories: categories.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <div key={cat.id} className="space-y-3 rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <input
              type="text"
              placeholder="输入分类名称"
              value={cat.name || ''}
              onChange={(e) => updateCategory(categories.indexOf(cat), { name: e.target.value })}
              className="flex-1 rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:placeholder:text-zinc-500 transition-colors focus:border-pink-300 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => removeCategory(categories.indexOf(cat))}
              className="ml-2 shrink-0 text-xs text-zinc-400 hover:text-red-500 transition-colors"
            >
              删除
            </button>
          </div>
          <SkillTags skills={cat.skills} onChange={(skills) => updateCategory(categories.indexOf(cat), { skills })} />
        </div>
      ))}
      <button type="button" onClick={addCategory} className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors">
        <span className="text-lg leading-none">+</span> 添加技能分类
      </button>
    </div>
  );
}

function SkillTags({ skills, onChange }: { skills: string[]; onChange: (s: string[]) => void }) {
  const [input, setInput] = useState('');

  const addSkill = () => {
    const v = input.trim();
    if (v && !skills.includes(v)) {
      onChange([...skills, v]);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {skills.map((skill) => (
          <span key={skill} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {skill}
            <button type="button" onClick={() => onChange(skills.filter((s) => s !== skill))} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">×</button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          placeholder="输入技能名称后回车添加…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:placeholder:text-zinc-500 transition-colors focus:border-pink-300 focus:outline-none"
        />
        <button
          type="button"
          onClick={addSkill}
          disabled={!input.trim()}
          className="shrink-0 rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-200 dark:text-zinc-800 dark:hover:bg-zinc-300"
        >
          添加
        </button>
      </div>
    </div>
  );
}

export function Projects({ section, onUpdate }: SectionComponentProps) {
  const d = c(section);
  const items: any[] = d.items || [];
  const updateItem = (idx: number, field: string, value: any) => { const n = [...items]; n[idx] = { ...n[idx], [field]: value }; onUpdate({ items: n }); };
  const addItem = () => onUpdate({ items: [...items, { id: makeId(), name: '', url: '', startDate: '', endDate: '', description: '', technologies: [], highlights: [] }] });
  const removeItem = (idx: number) => onUpdate({ items: items.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="space-y-3 rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <F label="项目名称" value={item.name || ''} onChange={(e) => updateItem(items.indexOf(item), 'name', e.target.value)} />
            <F label="项目链接" value={item.url || ''} onChange={(e) => updateItem(items.indexOf(item), 'url', e.target.value)} />
            <YearMonthPicker label="开始时间" value={item.startDate || ''} onChange={(v) => updateItem(items.indexOf(item), 'startDate', v)} />
            <YearMonthPicker label="结束时间" value={item.endDate || ''} onChange={(v) => updateItem(items.indexOf(item), 'endDate', v)} />
          </div>
          <TA label="描述" value={item.description || ''} onChange={(e) => updateItem(items.indexOf(item), 'description', e.target.value)} rows={2} />
          <div className="flex justify-end"><button type="button" onClick={() => removeItem(items.indexOf(item))} className="text-xs text-zinc-400 hover:text-red-500 transition-colors">删除</button></div>
        </div>
      ))}
      <button type="button" onClick={addItem} className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"><span className="text-lg leading-none">+</span> 添加项目</button>
    </div>
  );
}

export function Certifications({ section, onUpdate }: SectionComponentProps) {
  const d = c(section);
  const items: any[] = d.items || [];
  const updateItem = (idx: number, field: string, value: any) => { const n = [...items]; n[idx] = { ...n[idx], [field]: value }; onUpdate({ items: n }); };
  const addItem = () => onUpdate({ items: [...items, { id: makeId(), name: '', date: '', description: '' }] });
  const removeItem = (idx: number) => onUpdate({ items: items.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="space-y-3 rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <F label="名称" value={item.name || ''} onChange={(e) => updateItem(items.indexOf(item), 'name', e.target.value)} />
            <YearMonthPicker label="日期" value={item.date || ''} onChange={(v) => updateItem(items.indexOf(item), 'date', v)} />
          </div>
          <TA label="描述" value={item.description || ''} onChange={(e) => updateItem(items.indexOf(item), 'description', e.target.value)} rows={2} />
          <div className="flex justify-end"><button type="button" onClick={() => removeItem(items.indexOf(item))} className="text-xs text-zinc-400 hover:text-red-500 transition-colors">删除</button></div>
        </div>
      ))}
      <button type="button" onClick={addItem} className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"><span className="text-lg leading-none">+</span> 添加证书</button>
    </div>
  );
}

export function Languages({ section, onUpdate }: SectionComponentProps) {
  const d = c(section);
  const items: any[] = d.items || [];
  const updateItem = (idx: number, field: string, value: any) => { const n = [...items]; n[idx] = { ...n[idx], [field]: value }; onUpdate({ items: n }); };
  const addItem = () => onUpdate({ items: [...items, { id: makeId(), language: '', proficiency: '', description: '' }] });
  const removeItem = (idx: number) => onUpdate({ items: items.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="space-y-3 rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <F label="语言" value={item.language || ''} onChange={(e) => updateItem(items.indexOf(item), 'language', e.target.value)} />
            <F label="水平" value={item.proficiency || ''} onChange={(e) => updateItem(items.indexOf(item), 'proficiency', e.target.value)} />
          </div>
          <TA label="描述" value={item.description || ''} onChange={(e) => updateItem(items.indexOf(item), 'description', e.target.value)} rows={2} />
          <div className="flex justify-end"><button type="button" onClick={() => removeItem(items.indexOf(item))} className="text-xs text-zinc-400 hover:text-red-500 transition-colors">删除</button></div>
        </div>
      ))}
      <button type="button" onClick={addItem} className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"><span className="text-lg leading-none">+</span> 添加语言</button>
    </div>
  );
}

export function GitHub({ section, onUpdate }: SectionComponentProps) {
  const d = c(section);
  const items: any[] = d.items || [];
  const updateItem = (idx: number, field: string, value: any) => { const n = [...items]; n[idx] = { ...n[idx], [field]: value }; onUpdate({ items: n }); };
  const addItem = () => onUpdate({ items: [...items, { id: makeId(), repoUrl: '', name: '', stars: 0, language: '', description: '' }] });
  const removeItem = (idx: number) => onUpdate({ items: items.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="space-y-3 rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
          <F label="仓库名" value={item.name || ''} onChange={(e) => updateItem(items.indexOf(item), 'name', e.target.value)} />
          <F label="仓库地址" value={item.repoUrl || ''} onChange={(e) => updateItem(items.indexOf(item), 'repoUrl', e.target.value)} />
          <div className="flex justify-end"><button type="button" onClick={() => removeItem(items.indexOf(item))} className="text-xs text-zinc-400 hover:text-red-500 transition-colors">删除</button></div>
        </div>
      ))}
      <button type="button" onClick={addItem} className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"><span className="text-lg leading-none">+</span> 添加仓库</button>
    </div>
  );
}

export function QrCodes({ section, onUpdate }: SectionComponentProps) {
  const d = c(section);
  const items: Array<{ id: string; label: string; url: string }> = d.items || [];
  const updateItem = (idx: number, field: string, value: string) => { const n = [...items]; n[idx] = { ...n[idx], [field]: value }; onUpdate({ items: n }); };
  const addItem = () => onUpdate({ items: [...items, { id: makeId(), label: '', url: '' }] });
  const removeItem = (idx: number) => onUpdate({ items: items.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
          <F label="标签" value={item.label} onChange={(e) => updateItem(items.indexOf(item), 'label', e.target.value)} className="flex-1" />
          <F label="URL" value={item.url} onChange={(e) => updateItem(items.indexOf(item), 'url', e.target.value)} className="flex-1" />
          <button type="button" onClick={() => removeItem(items.indexOf(item))} className="shrink-0 text-xs text-zinc-400 hover:text-red-500 transition-colors">删除</button>
        </div>
      ))}
      <button type="button" onClick={addItem} className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"><span className="text-lg leading-none">+</span> 添加二维码</button>
    </div>
  );
}

export function CustomSection({ section, onUpdate }: SectionComponentProps) {
  const d = c(section);
  const items: Array<{ id: string; title: string; subtitle?: string; date?: string; description: string }> = d.items || [];
  const updateItem = (idx: number, field: string, value: any) => { const n = [...items]; n[idx] = { ...n[idx], [field]: value }; onUpdate({ items: n }); };
  const addItem = () => onUpdate({ items: [...items, { id: makeId(), title: '', subtitle: '', date: '', description: '' }] });
  const removeItem = (idx: number) => onUpdate({ items: items.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="space-y-3 rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
          <div className="grid grid-cols-3 gap-x-4 gap-y-2">
            <F label="标题" value={item.title || ''} onChange={(e) => updateItem(items.indexOf(item), 'title', e.target.value)} />
            <F label="副标题" value={item.subtitle || ''} onChange={(e) => updateItem(items.indexOf(item), 'subtitle', e.target.value)} />
            <YearMonthPicker label="日期" value={item.date || ''} onChange={(v) => updateItem(items.indexOf(item), 'date', v)} />
          </div>
          <TA label="描述" value={item.description || ''} onChange={(e) => updateItem(items.indexOf(item), 'description', e.target.value)} rows={2} />
          <div className="flex justify-end"><button type="button" onClick={() => removeItem(items.indexOf(item))} className="text-xs text-zinc-400 hover:text-red-500 transition-colors">删除</button></div>
        </div>
      ))}
      <button type="button" onClick={addItem} className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"><span className="text-lg leading-none">+</span> 添加条目</button>
    </div>
  );
}
