import Groq from 'groq-sdk';
import { SYSTEM_PROMPT } from '../system-prompt';

type Message = { role: 'user' | 'assistant'; content: string };

export async function streamOllama(messages: Message[], requestModel?: string): Promise<ReadableStream> {
  const baseUrl = import.meta.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const model = requestModel || import.meta.env.OLLAMA_MODEL || 'gemma4';
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ollama' },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages], stream: true }),
  });
  if (!response.ok || !response.body) { const err = await response.text(); throw new Error(`Ollama error ${response.status}: ${err}`); }
  return response.body;
}

export async function streamGroq(messages: Message[]): Promise<ReadableStream> {
  const apiKey = import.meta.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured');
  const groq = new Groq({ apiKey });
  const chatCompletion = await groq.chat.completions.create({
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    model: 'openai/gpt-oss-20b', temperature: 1, max_completion_tokens: 8192, top_p: 1, stream: true, reasoning_effort: 'medium', stop: null,
  });
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of chatCompletion) controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (error) { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })}\n\n`)); }
      finally { controller.close(); }
    },
  });
}

export function validateMessages(messages: unknown): messages is Message[] {
  if (!Array.isArray(messages) || messages.length === 0) return false;
  return messages.every((m) => m && typeof m === 'object' && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string');
}
