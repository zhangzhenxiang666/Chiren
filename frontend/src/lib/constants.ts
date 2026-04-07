export const TEMPLATES = [
  'classic', 'modern', 'two-column', 'creative',
] as const;
export type Template = (typeof TEMPLATES)[number];

export const BACKGROUND_TEMPLATES: ReadonlySet<string> = new Set([
  'modern', 'creative', 'two-column',
]);

export const TWO_COLUMN_TEMPLATES: Record<string, { bg: string; width: string }> = {
  'two-column': { bg: '#16213e', width: '35%' },
};

export const AUTOSAVE_DELAY = 500;
export const MAX_UNDO_STACK = 50;
