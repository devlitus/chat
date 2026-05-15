import { useCallback } from 'react';
import {
  addUserMessage, updateChatInList, startStreaming,
  updateStreaming, finishStreaming, setBotError, setChats,
} from '../../../stores/chat-actions';
import { addMessage, getMessagesByChatId, getChat, updateChat, getAllChats } from '../../../lib/db';
import { streamChat } from '../../../lib/groq-client';
import { $selectedProvider, $selectedGroqModel } from '../../../stores/chat-store';
import { detectWidgetFromModelResponse, detectWidgetFromKeywords, uriMap } from '../utils/widget-detector';
import { buildSpreadsheetContext } from '../utils/build-history-context';

export function useSendMessage(
  activeChatId: string | null,
  selectedModel: string | undefined,
  text: string,
  pendingFile: { id: string; name: string; type: string } | null,
  isStreaming: boolean,
  onSendComplete: () => void
) {
  return useCallback(async () => {
    let trimmed = text.trim();
    if ((!trimmed && !pendingFile) || !activeChatId || isStreaming) return;

    if (pendingFile) {
      trimmed = `[Archivo subido a temp id: ${pendingFile.id}]: ${pendingFile.name} (${pendingFile.type})\n\n` + trimmed;
    }

    onSendComplete();

    try {
      const userMessage = await addMessage(activeChatId, 'user', trimmed);
      addUserMessage(userMessage);

      const chat = await getChat(activeChatId);
      if (chat && chat.messageCount <= 1) {
        const title = trimmed.length > 50 ? trimmed.substring(0, 50) + '...' : trimmed;
        const updated = await updateChat(activeChatId, { title });
        updateChatInList(updated);
      }

      const allMessages = await getMessagesByChatId(activeChatId);
      const history = allMessages.map(m => ({ role: m.role, content: m.content }));

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

      const provider = $selectedProvider.get();
      const groqModel = $selectedGroqModel.get();
      for await (const token of streamChat(history, selectedModel, provider, groqModel)) {
        fullContent += token;
        if (!rafPending) {
          rafPending = true;
          requestAnimationFrame(() => { updateStreaming(fullContent); rafPending = false; });
        }
      }
      updateStreaming(fullContent);

      let uiResourceUri = detectWidgetFromModelResponse(fullContent);
      if (!uiResourceUri && /widget/i.test(fullContent)) {
        uiResourceUri = detectWidgetFromKeywords(trimmed);
      }
      if (forcedWidgetChart) uiResourceUri = uriMap.chart;

      const cleanContent = fullContent.replace(/\[WIDGET:(weather|time|crypto|travel|chart)\]/i, '').trimEnd();
      const botMessage = await addMessage(activeChatId, 'assistant', cleanContent, uiResourceUri);
      finishStreaming(botMessage);

      const chats = await getAllChats();
      setChats(chats);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      setBotError(`No se pudo obtener respuesta: ${msg}`);
    }
  }, [text, activeChatId, isStreaming, selectedModel, pendingFile, onSendComplete]);
}
