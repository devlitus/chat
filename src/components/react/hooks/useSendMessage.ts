import { useCallback } from 'react';
import {
  addUserMessage, updateChatInList, startStreaming,
  updateStreaming, finishStreaming, setBotError, setChats,
  setResearchProgress, clearResearchProgress,
} from '../../../stores/chat-actions';
import { addMessage, getMessagesByChatId, getChat, updateChat, getAllChats } from '../../../lib/db';
import { streamChat } from '../../../lib/groq-client';
import { $selectedProvider, $selectedGroqModel, $researchMode } from '../../../stores/chat-store';
import type { ResearchProgressEvent } from '../../../lib/api/research-tools';
import { buildSpreadsheetContext } from '../utils/build-history-context';
import { WIDGET_URI_MAP } from '../../../lib/api/tools';
import type { MessageContent } from '../../../lib/api/chat-stream';

const ALLOWED_WIDGET_URIS = new Set(Object.values(WIDGET_URI_MAP));

const CHART_URI = 'ui://mcp-app-demo/chart-app';

function detectWidgetFromKeywords(userMessage: string): string | undefined {
  const lower = userMessage.toLowerCase();
  const isWeather = lower.includes('clima') || lower.includes('tiempo') ||
    lower.includes('lluv') || lower.includes('temperatura') ||
    lower.includes('weather') || lower.includes('pronóstico') ||
    lower.includes('pronostico') || lower.includes('rain') || lower.includes('forecast');
  const isTime = lower.includes('hora') || lower.includes('time') || lower === '/mcp';
  const isCrypto = lower.includes('crypto') || lower.includes('bitcoin') ||
    lower.includes('btc') || lower.includes('ethereum') ||
    lower.includes('eth') || lower.includes('solana') ||
    lower.includes('sol') || lower.includes('cripto') ||
    (lower.includes('precio') && (lower.includes('moneda') || lower.includes('coin')));
  const isTravel = lower.includes('viaje') || lower.includes('vuelo') ||
    lower.includes('hotel') || lower.includes('destino') ||
    lower.includes('turismo') || lower.includes('vacaciones') || lower.includes('viajar');
  const isChart = lower.includes('gráfico') || lower.includes('grafico') ||
    lower.includes('gráfica') || lower.includes('grafica') ||
    lower.includes('diagrama') || lower.includes('compara') || lower.includes('visualiza');
  if (isWeather) return WIDGET_URI_MAP['weather'];
  if (isTime) return WIDGET_URI_MAP['time'];
  if (isCrypto) return WIDGET_URI_MAP['crypto'];
  if (isTravel) return WIDGET_URI_MAP['travel'];
  if (isChart) return WIDGET_URI_MAP['chart'];
  return undefined;
}

export function useSendMessage(
  activeChatId: string | null,
  selectedModel: string | undefined,
  text: string,
  pendingFile: { id: string; name: string; type: string; base64?: string; mimeType?: string } | null,
  isStreaming: boolean,
  onSendComplete: () => void
) {
  return useCallback(async () => {
    let trimmed = text.trim();
    if ((!trimmed && !pendingFile) || !activeChatId || isStreaming) return;

    const isImage = pendingFile !== null &&
      pendingFile.type === 'Imagen' &&
      pendingFile.base64 !== undefined &&
      pendingFile.mimeType !== undefined;

    if (pendingFile && !isImage) {
      trimmed = `[Archivo subido a temp id: ${pendingFile.id}]: ${pendingFile.name} (${pendingFile.type})\n\n` + trimmed;
    }

    onSendComplete();

    try {
      const userMessage = await addMessage(
        activeChatId,
        'user',
        isImage ? `[Imagen: ${pendingFile.name}]\n\n${trimmed}` : trimmed
      );
      addUserMessage(userMessage);

      const chat = await getChat(activeChatId);
      if (chat && chat.messageCount <= 1) {
        const displayTitle = trimmed || pendingFile?.name || 'Imagen';
        const title = displayTitle.length > 50 ? displayTitle.substring(0, 50) + '...' : displayTitle;
        const updated = await updateChat(activeChatId, { title });
        updateChatInList(updated);
      }

      const allMessages = await getMessagesByChatId(activeChatId);
      const history: { role: 'user' | 'assistant'; content: MessageContent }[] = allMessages.map(m => ({ role: m.role, content: m.content }));

      if (isImage && history.length > 0) {
        const lastMsg = history[history.length - 1];
        const imagePart = { type: 'image_url' as const, image_url: { url: `data:${pendingFile.mimeType};base64,${pendingFile.base64}` } };
        lastMsg.content = trimmed
          ? [{ type: 'text' as const, text: trimmed }, imagePart]
          : [imagePart];
      }

      const lowerMsg = trimmed.toLowerCase();
      const isChartTopic = lowerMsg.includes('gráfico') || lowerMsg.includes('grafico') ||
        lowerMsg.includes('gráfica') || lowerMsg.includes('grafica') ||
        lowerMsg.includes('diagrama') || lowerMsg.includes('compara') ||
        lowerMsg.includes('visualiza') || lowerMsg.includes('cálculo') ||
        lowerMsg.includes('calcula') || lowerMsg.includes('tabla');

      const forcedWidgetChart = await buildSpreadsheetContext(
        allMessages, history
      ) && isChartTopic;

      startStreaming();

      let fullContent = '';
      let rafPending = false;
      let detectedWidgetUri: string | undefined;

      const provider = $selectedProvider.get();
      const groqModel = $selectedGroqModel.get();
      const researchMode = $researchMode.get();

      if (researchMode) {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history, model: selectedModel, provider, groqModel, research: true }),
        });
        if (!response.ok) throw new Error(`API error ${response.status}`);
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No readable stream');
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6);
            if (raw === '[DONE]') break;
            try {
              const parsed = JSON.parse(raw) as Record<string, unknown>;
              const evtType = typeof parsed.type === 'string' ? parsed.type : '';
              const isProgressEvent = evtType === 'searching' || evtType === 'reading_url' || evtType === 'synthesizing' || evtType === 'research_plan' || evtType === 'research_done';
              if (isProgressEvent) {
                setResearchProgress(parsed as unknown as ResearchProgressEvent);
              } else {
                const token = (parsed as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content;
                if (token) {
                  fullContent += token;
                  if (!rafPending) {
                    rafPending = true;
                    requestAnimationFrame(() => { updateStreaming(fullContent); rafPending = false; });
                  }
                }
              }
            } catch {
              // linea parcial, ignorar
            }
          }
        }
        clearResearchProgress();
      } else {
        for await (const event of streamChat(history, selectedModel, provider, groqModel)) {
          if (event.type === 'widget') {
            detectedWidgetUri = event.uri;
          } else {
            fullContent += event.content;
            if (!rafPending) {
              rafPending = true;
              requestAnimationFrame(() => { updateStreaming(fullContent); rafPending = false; });
            }
          }
        }
      }
      updateStreaming(fullContent);

      if (!detectedWidgetUri) detectedWidgetUri = detectWidgetFromKeywords(trimmed);
      if (forcedWidgetChart && !detectedWidgetUri) detectedWidgetUri = CHART_URI;

      const safeUri = detectedWidgetUri && ALLOWED_WIDGET_URIS.has(detectedWidgetUri)
        ? detectedWidgetUri
        : undefined;

      const cleanContent = fullContent.trimEnd();
      const botMessage = await addMessage(activeChatId, 'assistant', cleanContent, safeUri);
      finishStreaming(botMessage);

      const chats = await getAllChats();
      setChats(chats);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      setBotError(`No se pudo obtener respuesta: ${msg}`);
    }
  }, [text, activeChatId, isStreaming, selectedModel, pendingFile, onSendComplete]);
}
