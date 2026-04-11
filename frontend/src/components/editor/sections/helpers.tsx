import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1960 + 1 }, (_, i) => CURRENT_YEAR - i);
const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export const YearMonthPicker = ({
  label,
  value = '',
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
}) => {
  const parse = (): [number, number] => {
    if (!value) return [CURRENT_YEAR, 0];
    const parts = value.split('.');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1] || '1', 10) - 1;
    return [isNaN(y) ? CURRENT_YEAR : y, isNaN(m) ? 0 : m];
  };
  const [selYear, selMonth] = parse();
  const [pickerYear, setPickerYear] = useState(selYear);
  const [open, setOpen] = useState(false);
  const display = value || '选择日期';

  const prevYear = () => setPickerYear((y) => y - 1);
  const nextYear = () => setPickerYear((y) => y + 1);

  const handleSelect = (m: number) => {
    onChange(`${pickerYear}.${String(m + 1).padStart(2, '0')}`);
    setOpen(false);
  };

  return (
    <label className="block text-xs text-zinc-500">
      <span>{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="mt-1 flex w-full items-center justify-between rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 transition-colors hover:border-zinc-300 focus:border-pink-300 focus:outline-none"
          >
            <span className={!value ? 'text-zinc-400 dark:text-zinc-500' : ''}>{display}</span>
            <CalendarIcon className="ml-1 h-3.5 w-3.5 shrink-0 text-zinc-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900" align="start" sideOffset={8}>
          {/* Year nav */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevYear} className="rounded p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{pickerYear}年</span>
            <button type="button" onClick={nextYear} className="rounded p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {/* 12-month grid */}
          <div className="grid grid-cols-4 gap-1.5">
            {MONTH_LABELS.map((label, i) => {
              const isSelected = pickerYear === selYear && i === selMonth;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelect(i)}
                  className={cn(
                    'h-8 rounded-lg text-xs font-medium transition-colors',
                    isSelected
                      ? 'bg-pink-500 text-white hover:bg-pink-600'
                      : 'bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </label>
  );
};

export const F = ({ label, ...props }: { label: string } & Omit<ComponentProps<'input'>, 'ref'>) => (
  <label className="block text-xs text-zinc-500">
    <span>{label}</span>
    <input className="mt-1 w-full rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:placeholder:text-zinc-500 transition-colors focus:border-pink-300 focus:outline-none" {...props} />
  </label>
);

function AutoResizeTextarea(props: Omit<ComponentProps<'textarea'>, 'ref'>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  });

  return (
    <textarea
      ref={ref}
      rows={1}
      className="mt-1 w-full rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:placeholder:text-zinc-500 transition-colors focus:border-pink-300 focus:outline-none resize-none overflow-hidden"
      {...props}
    />
  );
}

export const TA = ({ label, ...props }: { label: string } & Omit<ComponentProps<'textarea'>, 'ref'>) => (
  <label className="block text-xs text-zinc-500">
    <span>{label}</span>
    <AutoResizeTextarea {...props} />
  </label>
);

export const c = (section: { content: unknown }) => section.content as any;

export type SectionComponentProps = {
  section: { content: unknown };
  onUpdate: (content: Record<string, unknown>) => void;
};

export function addItemState<T extends { id: string }>(items: T[], newItem: T): T[] {
  return [...items, newItem];
}

export function makeId(): string {
  return crypto.randomUUID?.() || Math.random().toString(36).slice(2);
}

export function FieldWrapper({ children, columns = 2 }: { children: React.ReactNode; columns?: number }) {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {children}
    </div>
  );
}

export const S = ({ label, value, options, onChange, placeholder }: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
}) => {
  const id = `select-${label}`;
  return (
    <div>
      <span id={id} className="block text-xs text-zinc-500">{label}</span>
      <Select value={value || ''} onValueChange={onChange} aria-labelledby={id}>
        <SelectTrigger className="mt-1 border-zinc-700 bg-zinc-800/50 text-zinc-100" aria-labelledby={id}>
          <SelectValue placeholder={placeholder || '请选择'} />
        </SelectTrigger>
        <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-200">
          {options.map((opt) => (
            <SelectItem key={opt} value={opt} className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
