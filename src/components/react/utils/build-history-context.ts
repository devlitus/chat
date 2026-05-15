import type { Message } from '../../../lib/db';

export async function buildSpreadsheetContext(
  allMessages: Message[],
  history: { role: string; content: string }[]
): Promise<boolean> {
  const latestSpreadsheetMsg = allMessages.slice().reverse().find(
    m => m.role === 'user' && m.content.includes('(Hoja de cálculo)') && m.content.includes('id:')
  );

  if (!latestSpreadsheetMsg) return false;

  const lastMsg = history[history.length - 1];
  if (!lastMsg || lastMsg.role !== 'user') return false;

  const match = latestSpreadsheetMsg.content.match(/temp id:\s*([a-zA-Z0-9_\-.]+)/);
  if (!match) return false;

  try {
    const dataRes = await fetch(`/api/read-temp?file=${match[1]}`);
    if (!dataRes.ok) return false;

    const { content } = await dataRes.json();
    const lines = content.split('\n').filter(Boolean).slice(0, 30).join('\n');

    lastMsg.content += `\n\n[CONTEXTO DEL SISTEMA: El usuario subió un archivo previamente. Usa estos datos iniciales para tu análisis:\n${lines}\n\nREGLA ESTRICTA: Tu respuesta DEBE terminar obligatoriamente con este bloque JSON cerrado dentro de etiquetas <chart-data>: \n<chart-data>\n[ {"name": "Categoria", "value": 10} ]\n</chart-data>]`;
    return true;
  } catch {
    return false;
  }
}
