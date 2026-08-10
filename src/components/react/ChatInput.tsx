import { useState, useRef, useCallback, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { $activeChatId, $isStreaming, $selectedModel, $pendingInputText } from '../../stores/chat-store';
import { clearPendingInputText } from '../../stores/chat-actions';
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
  const pendingInputText = useStore($pendingInputText);
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Inserta el texto reutilizado desde una burbuja de usuario en la
  // posición del cursor (o al final si el textarea nunca tuvo foco), y
  // recoloca el foco/cursor tras el re-render.
  //
  // El updater de setText solo calcula el nuevo valor de forma pura; el
  // side-effect de DOM (focus/selección) se ejecuta fuera del callback,
  // una vez conocida la posición de cursor resultante, para no violar la
  // pureza esperada de los updaters funcionales de React.
  useEffect(() => {
    if (pendingInputText === null) return;
    const textarea = textareaRef.current;
    const isFocused = textarea != null && document.activeElement === textarea;

    const cursor = { pos: 0 };
    setText((prev) => {
      const start = isFocused ? textarea!.selectionStart ?? prev.length : prev.length;
      const end = isFocused ? textarea!.selectionEnd ?? prev.length : prev.length;
      cursor.pos = start + pendingInputText.length;
      return prev.slice(0, start) + pendingInputText + prev.slice(end);
    });

    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(cursor.pos, cursor.pos);
    });

    clearPendingInputText();
  }, [pendingInputText]);

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
        <MessageTextarea ref={textareaRef} value={text} onChange={e => setText(e.target.value)}
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
