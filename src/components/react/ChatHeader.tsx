// src/components/react/ChatHeader.tsx

import { useMemo, useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $chats, $activeChatId, $selectedModel } from '../../stores/chat-store';

function ModelSelector() {
  const selectedModel = useStore($selectedModel);
  const [models, setModels] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch('/api/models')
      .then((r) => r.json())
      .then((data) => {
        const list: string[] = data.models ?? [];
        setModels(list);
        if (list.length > 0 && (!selectedModel || !list.includes(selectedModel))) {
          $selectedModel.set(list.includes('gemma4') ? 'gemma4' : list[0]);
        }
      })
      .catch(() => {});
  }, []);

  if (models.length === 0) return null;

  const displayName = selectedModel ? selectedModel.split(':')[0] : '—';

  return (
    <div className="model-selector">
      <button
        className="model-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      >
        <span className="material-symbols-outlined model-icon" aria-hidden="true">memory</span>
        <span className="model-name">{displayName}</span>
        <span className="material-symbols-outlined model-chevron" aria-hidden="true">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {open && (
        <ul className="model-dropdown" role="listbox" aria-label="Seleccionar modelo">
          {models.map((m) => (
            <li
              key={m}
              role="option"
              aria-selected={selectedModel === m}
              className={`model-option${selectedModel === m ? ' model-option--active' : ''}`}
              onMouseDown={() => {
                $selectedModel.set(m);
                setOpen(false);
              }}
            >
              {m}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ChatHeader() {
  const chats = useStore($chats);
  const activeChatId = useStore($activeChatId);
  const selectedModel = useStore($selectedModel);

  const title = useMemo(() => {
    const chat = chats.find((c) => c.id === activeChatId);
    return chat?.title ?? 'Nuevo chat';
  }, [chats, activeChatId]);

  const modelDisplayName = selectedModel ? selectedModel.split(':')[0] : 'gemma4';

  return (
    <header className="chat-header">
      <div className="chat-header-left">
        <h2>
          <span className="material-symbols-outlined star-icon">auto_awesome</span>
          <span>{title}</span>
        </h2>
        <span className="badge">{modelDisplayName}</span>
      </div>
      <div className="chat-header-right">
        <button
          className="fav-btn"
          aria-label="Favoritos"
          aria-pressed={false}
          onClick={() => {}} // TODO: implementar favoritos
        >
          <span className="material-symbols-outlined heart-icon" aria-hidden="true">favorite</span>
          <span className="fav-text">Favorite Chats</span>
        </button>
        <ModelSelector />
      </div>
    </header>
  );
}

