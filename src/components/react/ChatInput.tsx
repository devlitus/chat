// src/components/react/ChatInput.tsx

import { useState, useRef, useCallback, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { $activeChatId, $isStreaming } from '../../stores/chat-store';
import {
  addUserMessage,
  updateChatInList,
  startStreaming,
  updateStreaming,
  finishStreaming,
  setBotError,
  setChats,
} from '../../stores/chat-actions';
import { addMessage, getMessagesByChatId, getChat, updateChat, getAllChats } from '../../lib/db';
import { streamChat } from '../../lib/groq-client';

const WIDGET_RE = /\[WIDGET:(weather|time|crypto|travel|chart)\]/i;

export function ChatInput() {
  const activeChatId = useStore($activeChatId);
  const isStreaming = useStore($isStreaming);
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<{ id: string; name: string; type: string } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChatId || isStreaming) return;

    try {
      const fileName = file.name;
      const lowerName = fileName.toLowerCase();
      const isSpreadsheet = lowerName.endsWith('.csv') || lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls');
      const isPdf = lowerName.endsWith('.pdf');

      if (!isSpreadsheet && !isPdf) {
        setBotError("Tipo de archivo no admitido. Solo CSV, Excel y PDF.");
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Error al subir el archivo al servidor local');
      const apiData = await res.json();
      const tempFilename = apiData.filename;

      setPendingFile({
        id: tempFilename,
        name: fileName,
        type: isPdf ? 'Documento PDF' : 'Hoja de cálculo'
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      setBotError(`No se pudo procesar el archivo: ${errorMsg}`);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [text]);

  const sendMessage = useCallback(async () => {
    let trimmed = text.trim();
    if ((!trimmed && !pendingFile) || !activeChatId || isStreaming) return;

    if (pendingFile) {
      const filePrefix = `[Archivo subido a temp id: ${pendingFile.id}]: ${pendingFile.name} (${pendingFile.type})\n\n`;
      trimmed = filePrefix + trimmed;
    }

    setText('');
    setPendingFile(null);

    try {
      // 1. Guardar mensaje del usuario
      const userMessage = await addMessage(activeChatId, 'user', trimmed);
      addUserMessage(userMessage);

      // 2. Generar titulo si es primer mensaje
      const chat = await getChat(activeChatId);
      if (chat && chat.messageCount <= 1) {
        const title = trimmed.length > 50 ? trimmed.substring(0, 50) + '...' : trimmed;
        const updated = await updateChat(activeChatId, { title });
        updateChatInList(updated);
      }

      // 3. Obtener historial
      const allMessages = await getMessagesByChatId(activeChatId);
      const history = allMessages.map((m) => ({ role: m.role, content: m.content }));

      const latestSpreadsheetMsg = allMessages.slice().reverse().find(
          m => m.role === 'user' && m.content.includes('(Hoja de cálculo)') && m.content.includes('id:')
      );

      const lowerMsg = trimmed.toLowerCase();
      const isChartTopic =
          lowerMsg.includes('gráfico') || lowerMsg.includes('grafico') ||
          lowerMsg.includes('gráfica') || lowerMsg.includes('grafica') ||
          lowerMsg.includes('diagrama') || lowerMsg.includes('compara') ||
          lowerMsg.includes('visualiza') || lowerMsg.includes('cálculo') ||
          lowerMsg.includes('calcula') || lowerMsg.includes('tabla');
      
      let forcedWidgetChart = false;

      if (latestSpreadsheetMsg && isChartTopic) {
        const match = latestSpreadsheetMsg.content.match(/temp id:\s*([a-zA-Z0-9_\-.]+)/);
        if (match) {
           const tempFileId = match[1];
           try {
             const dataRes = await fetch(`/api/read-temp?file=${tempFileId}`);
             if (dataRes.ok) {
                const { content } = await dataRes.json();
                const lines = content.split('\n').filter(Boolean).slice(0, 30).join('\n');
                
                const lastHistoryUserMsg = history[history.length - 1];
                if (lastHistoryUserMsg && lastHistoryUserMsg.role === 'user') {
                    lastHistoryUserMsg.content += `\n\n[CONTEXTO DEL SISTEMA: El usuario subió un archivo previamente. Usa estos datos iniciales para tu análisis:\n${lines}\n\nREGLA ESTRICTA: Tu respuesta DEBE terminar obligatoriamente con este bloque JSON cerrado dentro de etiquetas <chart-data>: \n<chart-data>\n[ {"name": "Categoria", "value": 10} ]\n</chart-data>]`;
                    forcedWidgetChart = true;
                }
             }
           } catch (e) {
             console.error("Error reading temp file data", e);
           }
        }
      }

      // 4. Streaming + detección de widget por marcador del modelo
      startStreaming();

      let fullContent = '';
      let rafPending = false;

      for await (const token of streamChat(history)) {
        fullContent += token;
        if (!rafPending) {
          rafPending = true;
          requestAnimationFrame(() => {
            updateStreaming(fullContent);
            rafPending = false;
          });
        }
      }
      // Flush final: garantiza que el atom refleja el contenido completo
      // antes de que finishStreaming procese el mensaje
      updateStreaming(fullContent);

      // 5. Extraer marcador de widget si el modelo lo incluyó
      const widgetMatch = fullContent.match(WIDGET_RE);
      const cleanContent = fullContent.replace(WIDGET_RE, '').trimEnd();

      const uriMap: Record<string, string> = {
        weather: 'ui://mcp-app-demo/weather-app',
        time: 'ui://mcp-app-demo/mcp-app',
        crypto: 'ui://mcp-app-demo/crypto-app',
        travel: 'ui://mcp-app-demo/travel-app',
        chart: 'ui://mcp-app-demo/chart-app',
      };

      let uiResourceUri: string | undefined;
      if (widgetMatch) {
        // Marcador explícito del modelo
        uiResourceUri = uriMap[widgetMatch[1].toLowerCase()];
      } else if (/widget/i.test(fullContent)) {
        // Fallback: el modelo mencionó "widget" pero no emitió el marcador exacto
        const lowerMsg = trimmed.toLowerCase();
        const isWeatherTopic =
          lowerMsg.includes('clima') || lowerMsg.includes('tiempo') ||
          lowerMsg.includes('lluv') || lowerMsg.includes('temperatura') ||
          lowerMsg.includes('weather') || lowerMsg.includes('pronóstico') ||
          lowerMsg.includes('pronostico') || lowerMsg.includes('rain') ||
          lowerMsg.includes('forecast');
        const isTimeTopic =
          lowerMsg.includes('hora') || lowerMsg.includes('time') || lowerMsg === '/mcp';
        const isCryptoTopic =
          lowerMsg.includes('crypto') || lowerMsg.includes('bitcoin') ||
          lowerMsg.includes('btc') || lowerMsg.includes('ethereum') ||
          lowerMsg.includes('eth') || lowerMsg.includes('solana') ||
          lowerMsg.includes('sol') || lowerMsg.includes('criptomoneda') ||
          (lowerMsg.includes('precio') && (lowerMsg.includes('moneda') || lowerMsg.includes('coin')));
        const isTravelTopic =
          lowerMsg.includes('viaje') || lowerMsg.includes('vuelo') ||
          lowerMsg.includes('hotel') || lowerMsg.includes('destino') ||
          lowerMsg.includes('turismo') || lowerMsg.includes('vacaciones') ||
          lowerMsg.includes('viajar');
        const isChartTopic =
          lowerMsg.includes('gráfico') || lowerMsg.includes('grafico') ||
          lowerMsg.includes('gráfica') || lowerMsg.includes('grafica') ||
          lowerMsg.includes('diagrama') || lowerMsg.includes('compara') ||
          lowerMsg.includes('visualiza');

        if (isWeatherTopic) uiResourceUri = uriMap.weather;
        else if (isTimeTopic) uiResourceUri = uriMap.time;
        else if (isCryptoTopic) uiResourceUri = uriMap.crypto;
        else if (isTravelTopic) uiResourceUri = uriMap.travel;
        else if (isChartTopic) uiResourceUri = uriMap.chart;
      }

      if (forcedWidgetChart) {
          uiResourceUri = uriMap.chart;
      }

      const botMessage = await addMessage(activeChatId, 'assistant', cleanContent, uiResourceUri);
      finishStreaming(botMessage);

      // 6. Refrescar lista de chats
      const chats = await getAllChats();
      setChats(chats);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      setBotError(`No se pudo obtener respuesta: ${errorMsg}`);
    }

    // Focus de vuelta al textarea
    textareaRef.current?.focus();
  }, [text, activeChatId, isStreaming]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  return (
    <div className="chat-input-area">
      {pendingFile && (
        <div className="pending-file-chip">
          <span className="material-symbols-outlined pending-file-icon">
            {pendingFile.type.includes('Hoja de cálculo') ? 'table_chart' : 'picture_as_pdf'}
          </span>
          <span className="pending-file-name">{pendingFile.name}</span>
          <button 
            onClick={() => setPendingFile(null)} 
            className="pending-file-close"
            title="Quitar archivo"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}
      <div className="input-wrapper">
        <button 
          className="icon-btn" 
          title="Attach file" 
          aria-label="Attach file"
          disabled={isStreaming}
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="material-symbols-outlined" aria-hidden="true">attach_file</span>
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          hidden 
          accept=".csv,.xlsx,.xls,.pdf" 
          onChange={handleFileChange} 
        />
        <textarea
          ref={textareaRef}
          placeholder="Type a message..."
          rows={1}
          aria-label="Type a message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="right-buttons">
          <button className="icon-btn" title="Use Microphone" aria-label="Use Microphone">
            <span className="material-symbols-outlined" aria-hidden="true">mic</span>
          </button>
          <button
            className="send-btn"
            title="Send message"
            aria-label="Send message"
            onClick={sendMessage}
            disabled={isStreaming || !text.trim()}
          >
            <span className="material-symbols-outlined" aria-hidden="true">send</span>
          </button>
        </div>
      </div>
      <p className="disclaimer">AI can make mistakes. Please review generated code.</p>
    </div>
  );
}
