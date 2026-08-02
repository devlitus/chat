// src/lib/groq-client.ts
import type { MessageContent } from './api/chat-stream';

export interface ChatRequestBody {
  messages: Array<{ role: 'user' | 'assistant'; content: MessageContent }>;
  model?: string;
  provider?: 'local' | 'groq';
  groqModel?: string;
  research?: boolean;
}

export type StreamEvent =
  | { type: 'token'; content: string }
  | { type: 'widget'; uri: string };

export async function* streamChat(
  messages: Array<{ role: 'user' | 'assistant'; content: MessageContent }>,
  model?: string,
  provider?: 'local' | 'groq',
  groqModel?: string,
  research?: boolean,
): AsyncGenerator<StreamEvent, void, unknown> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model, provider, groqModel, research } satisfies ChatRequestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No readable stream');

  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);

          if (parsed.type === 'widget' && typeof parsed.uri === 'string') {
            yield { type: 'widget', uri: parsed.uri };
            continue;
          }

          // Extraer SOLO el token estándar final. Ignoramos reasoning_content deliberadamente para no saturar al usuario,
          // lo que provocará que la UI muestre el Loading Spinner mientras el modelo piensa.
          const rawToken = parsed.choices?.[0]?.delta?.content;
          if (rawToken != null && rawToken !== '') {
            const token = typeof rawToken === 'string' ? rawToken : String(rawToken);
            yield { type: 'token', content: token };
          }
        } catch {
          // Linea parcial, ignorar
        }
      }
    }
  }
}
