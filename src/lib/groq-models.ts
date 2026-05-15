export const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

const REASONING_PATTERNS = ['qwq', '-r1-', 'gpt-oss', 'deepseek-r'];

export function isReasoningModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return REASONING_PATTERNS.some(p => lower.includes(p));
}
