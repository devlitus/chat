// src/components/react/ChatHeader.tsx

import { useMemo, useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $chats, $activeChatId, $selectedModel, $selectedProvider, $selectedGroqModel } from '../../stores/chat-store';
import { isReasoningModel, DEFAULT_GROQ_MODEL } from '../../lib/groq-models';

function ProviderSelector() {
  const provider = useStore($selectedProvider);

  useEffect(() => {
    // Migración: usuarios existentes pueden tener 'ollama' persistido de
    // antes de renombrar el proveedor interno a 'local'. Se convierte de
    // forma transparente y se vuelve a guardar con el nombre nuevo.
    const saved = localStorage.getItem('selectedProvider');
    const normalized = saved === 'ollama' ? 'local' : saved;
    if (normalized === 'local' || normalized === 'groq') {
      $selectedProvider.set(normalized);
      if (saved !== normalized) localStorage.setItem('selectedProvider', normalized);
    }
  }, []);

  const select = (p: 'local' | 'groq') => {
    $selectedProvider.set(p);
    localStorage.setItem('selectedProvider', p);
  };

  return (
    <div className="provider-selector" role="group" aria-label="Proveedor LLM">
      <button
        className={`provider-btn${provider === 'local' ? ' provider-btn--active' : ''}`}
        onClick={() => select('local')}
        aria-pressed={provider === 'local'}
        title="Servidor local (LM Studio)"
      >
        <span className="material-symbols-outlined" aria-hidden="true">computer</span>
        <span className="provider-name">Local</span>
      </button>
      <button
        className={`provider-btn${provider === 'groq' ? ' provider-btn--active' : ''}`}
        onClick={() => select('groq')}
        aria-pressed={provider === 'groq'}
        title="Groq"
      >
        <span className="material-symbols-outlined" aria-hidden="true">cloud</span>
        <span className="provider-name">Groq</span>
      </button>
    </div>
  );
}

function GroqModelSelector() {
  const selectedGroqModel = useStore($selectedGroqModel);
  const [models, setModels] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('selectedGroqModel');
    if (saved) $selectedGroqModel.set(saved);

    fetch('/api/groq-models')
      .then(r => r.json())
      .then((data: { models: string[] }) => {
        const list = data.models ?? [];
        setModels(list);
        const current = $selectedGroqModel.get();
        if (!current || !list.includes(current)) {
          const def = list.includes(DEFAULT_GROQ_MODEL) ? DEFAULT_GROQ_MODEL : list[0];
          if (def) {
            $selectedGroqModel.set(def);
            localStorage.setItem('selectedGroqModel', def);
          }
        }
      })
      .catch(() => {});
  }, []);

  const select = (id: string) => {
    $selectedGroqModel.set(id);
    localStorage.setItem('selectedGroqModel', id);
    setOpen(false);
  };

  if (models.length === 0) return null;

  const reasoning = isReasoningModel(selectedGroqModel);

  return (
    <div className="model-selector">
      <button
        className="model-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      >
        <span className="material-symbols-outlined model-icon" aria-hidden="true">
          {reasoning ? 'psychology' : 'smart_toy'}
        </span>
        <span className="model-name">{selectedGroqModel}</span>
        <span className="material-symbols-outlined model-chevron" aria-hidden="true">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {open && (
        <ul className="model-dropdown" role="listbox" aria-label="Seleccionar modelo Groq">
          {models.map(id => (
            <li
              key={id}
              role="option"
              aria-selected={selectedGroqModel === id}
              className={`model-option${selectedGroqModel === id ? ' model-option--active' : ''}`}
              onMouseDown={() => select(id)}
            >
              <span>{id}</span>
              {isReasoningModel(id) && (
                <span className="model-option-tag">reasoning</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Nombre corto para mostrar en UI: los ids de LM Studio suelen venir con
// rutas anidadas ("carpeta/subcarpeta/archivo.gguf"), donde el segmento
// relevante es el último tras la última '/'. Los ids estilo Ollama
// ("modelo:tag") no tienen '/', así que siguen usando el primer segmento
// antes de ':'.
function modelDisplayName(id: string): string {
  if (id.includes('/')) return id.split('/').pop() as string;
  return id.split(':')[0];
}

function ModelSelector() {
  const selectedModel = useStore($selectedModel);
  const [models, setModels] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('selectedModel');
    if (saved) $selectedModel.set(saved);

    fetch('/api/models')
      .then((r) => r.json())
      .then((data) => {
        const list: string[] = data.models ?? [];
        setModels(list);
        const current = $selectedModel.get();
        if (list.length > 0 && (!current || !list.includes(current))) {
          const def = list.includes('gemma4') ? 'gemma4' : list[0];
          $selectedModel.set(def);
          localStorage.setItem('selectedModel', def);
        }
      })
      .catch(() => {});
  }, []);

  if (models.length === 0) {
    return (
      <span className="badge">
        {selectedModel ? modelDisplayName(selectedModel) : 'gemma4'}
      </span>
    );
  }

  const displayName = selectedModel ? modelDisplayName(selectedModel) : '—';

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
                localStorage.setItem('selectedModel', m);
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
  const provider = useStore($selectedProvider);
  const selectedGroqModel = useStore($selectedGroqModel);
  const [isFavorite, setIsFavorite] = useState<boolean>(false);

  const title = useMemo(() => {
    const chat = chats.find((c) => c.id === activeChatId);
    return chat?.title ?? 'Nuevo chat';
  }, [chats, activeChatId]);

  return (
    <header className="chat-header">
      <div className="chat-header-left">
        <h2>
          <span className="material-symbols-outlined star-icon">auto_awesome</span>
          <span className="chat-title-text">{title}</span>
        </h2>
        {provider === 'groq' ? (
          <span className="badge">{selectedGroqModel || 'Groq'}</span>
        ) : (
          <ModelSelector />
        )}
      </div>
      <div className="chat-header-right">
        <button
          className="fav-btn"
          aria-label="Favoritos"
          aria-pressed={isFavorite}
          onClick={() => setIsFavorite(v => !v)}
        >
          <span className="material-symbols-outlined heart-icon" aria-hidden="true">favorite</span>
          <span className="fav-text">Chats favoritos</span>
        </button>
        <ProviderSelector />
        {provider === 'groq' && <GroqModelSelector />}
      </div>
    </header>
  );
}

