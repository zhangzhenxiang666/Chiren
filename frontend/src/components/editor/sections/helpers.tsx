import type { ComponentProps } from 'react';
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from '@/components/ui/select';

export const F = ({ label, ...props }: { label: string } & Omit<ComponentProps<'input'>, 'ref'>) => (
  <label className="block text-xs text-zinc-500">
    <span>{label}</span>
    <input className="mt-1 w-full rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:placeholder:text-zinc-500 transition-colors focus:border-pink-300 focus:outline-none" {...props} />
  </label>
);

export const TA = ({ label, ...props }: { label: string } & Omit<ComponentProps<'textarea'>, 'ref'>) => (
  <label className="block text-xs text-zinc-500">
    <span>{label}</span>
    <textarea className="mt-1 w-full rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:placeholder:text-zinc-500 transition-colors focus:border-pink-300 focus:outline-none resize-y" {...props} />
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
