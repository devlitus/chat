import { useStore } from '@nanostores/react';
import { $researchProgress } from '../../../stores/chat-store';
import type { ResearchProgressEvent } from '../../../lib/api/research-tools';

function getLabel(progress: ResearchProgressEvent): string {
  switch (progress.type) {
    case 'research_plan':
      return 'Planificando investigacion...';
    case 'searching':
      return `Buscando: "${progress.query}" (${progress.index}/${progress.total})`;
    case 'reading_url':
      return `Leyendo: ${progress.title ?? progress.url}`;
    case 'synthesizing':
      return `Sintetizando ${progress.sources_count} fuentes...`;
    case 'research_done':
      return 'Investigacion completada';
    default:
      return 'Investigando...';
  }
}

function StreamingIndicatorFallback() {
  return (
    <div className="message-bot">
      <div className="avatar bot-avatar">
        <span className="material-symbols-outlined">smart_toy</span>
      </div>
      <div className="msg-content">
        <div className="meta">
          <span className="msg-name">Chat AI</span>
          <span className="msg-time">{new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div className="bubble bot-bubble">
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '14px', fontStyle: 'italic', minWidth: '110px', minHeight: '24px' }}>
            <svg aria-hidden="true" style={{ height: '20px', width: '20px', color: '#06b6d4', animation: 'local-spin 1s linear infinite', flexShrink: 0 }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="sr-only">El asistente está procesando</span>
            <span aria-hidden="true">Pensando...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ResearchProgress() {
  const progress = useStore($researchProgress);

  if (!progress) return <StreamingIndicatorFallback />;

  const label = getLabel(progress);

  return (
    <div className="message-bot">
      <div className="avatar bot-avatar">
        <span className="material-symbols-outlined">travel_explore</span>
      </div>
      <div className="msg-content">
        <div className="meta">
          <span className="msg-name">Deep Research</span>
        </div>
        <div className="bubble bot-bubble research-progress-bubble">
          <span
            className="material-symbols-outlined research-spinner"
            aria-hidden="true"
          >
            refresh
          </span>
          <span role="status">{label}</span>
        </div>
      </div>
    </div>
  );
}
