import { useState, useRef, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { $activeChatId, $isStreaming, $selectedModel } from '../../stores/chat-store';
import { useFileUpload } from './hooks/useFileUpload';
import { useSendMessage } from './hooks/useSendMessage';
import { PendingFileChip } from './input/PendingFileChip';
import { MessageTextarea } from './input/MessageTextarea';
import { SendButton } from './input/SendButton';
import { ResearchToggle } from './input/ResearchToggle';

export function ChatInput() {
  const activeChatId = useStore($activeChatId);
  const isStreaming = useStore($isStreaming);
  const selectedModel = useStore($selectedModel);
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { pendingFile, handleFileChange, clearPendingFile } =
    useFileUpload(activeChatId, isStreaming);

  const handleSendComplete = useCallback(() => {
    setText('');
    clearPendingFile();
  }, [clearPendingFile]);

  const sendMessage = useSendMessage(
    activeChatId, selectedModel, text, pendingFile, isStreaming, handleSendComplete
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  return (
    <div className="chat-input-area">
      {pendingFile && (
        <PendingFileChip file={pendingFile} onRemove={clearPendingFile} />
      )}
      <div className="input-wrapper">
        <button className="icon-btn" title="Adjuntar archivo" aria-label="Adjuntar archivo"
          disabled={isStreaming} onClick={() => fileInputRef.current?.click()}>
          <span className="material-symbols-outlined" aria-hidden="true">attach_file</span>
        </button>
        <ResearchToggle />
        <input type="file" ref={fileInputRef} hidden accept=".csv,.xlsx,.xls,.pdf,image/*"
          onChange={handleFileChange} />
        <MessageTextarea value={text} onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown} />
        <div className="right-buttons">
          <button className="icon-btn" title="Usar micrófono" aria-label="Usar micrófono">
            <span className="material-symbols-outlined" aria-hidden="true">mic</span>
          </button>
          <SendButton onClick={sendMessage} disabled={isStreaming || !text.trim()} />
        </div>
      </div>
      <p className="disclaimer">La IA puede cometer errores. Revisa el código generado.</p>
    </div>
  );
}
