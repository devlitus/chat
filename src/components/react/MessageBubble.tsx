// src/components/react/MessageBubble.tsx

import { useMemo, useEffect, useRef } from 'react';
import type { Message } from '../../lib/db';
import { renderMarkdown } from '../../lib/markdown';

interface Props {
  message: Message;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

export function MessageBubble({ message }: Props) {
  const time = formatTime(message.createdAt);

  const renderedHtml = useMemo(() => {
    if (message.role === 'assistant') {
      return renderMarkdown(message.content);
    }
    return null;
  }, [message.content, message.role]);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Escuchar directamente los mensajes del Iframe hijo sin usar SDK
    const handleMessage = (event: MessageEvent) => {
      // Validar que viene de un iframe nuestro (opcional, pero buena práctica)
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;

      const data = event.data;
      if (data && data.type === 'mcp_call_tool' && data.toolName === 'get-time') {
        const timeResult = new Date().toISOString();
        iframeRef.current.contentWindow?.postMessage({
          type: 'mcp_tool_result',
          toolName: 'get-time',
          time: timeResult
        }, '*');
      }

      if (data && data.type === 'mcp_call_tool' && data.toolName === 'get-location') {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            iframeRef.current?.contentWindow?.postMessage({
              type: 'mcp_tool_result',
              toolName: 'get-location',
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }, '*');
          },
          () => {
            iframeRef.current?.contentWindow?.postMessage({
              type: 'mcp_tool_result',
              toolName: 'get-location',
              error: 'permission-denied',
            }, '*');
          }
        );
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  if (message.role === 'user') {
    return (
      <div className="message-user">
        <div className="avatar user-avatar">
          <span className="material-symbols-outlined">person</span>
        </div>
        <div className="msg-content">
          <div className="meta">
            <span className="msg-time">{time}</span>
            <span className="msg-name">Tu</span>
          </div>
          <div className="bubble user-bubble">
            <p>{message.content}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="message-bot">
      <div className="avatar bot-avatar">
        <span className="material-symbols-outlined">smart_toy</span>
      </div>
      <div className="msg-content">
        <div className="meta">
          <span className="msg-name">Chat AI</span>
          <span className="msg-time">{time}</span>
        </div>

        {message.uiResourceUri ? (
          <div className="bubble bot-bubble mcp-ui-container" style={{ width: '100%', minWidth: '350px' }}>


            <div style={{ width: '100%', height: '500px', borderRadius: '8px', overflow: 'hidden', position: 'relative', backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <iframe
                ref={iframeRef}
                src={window.location.origin + (message.uiResourceUri?.replace('ui://mcp-app-demo', '') ?? '/mcp-app')}
                style={{ width: '100%', height: '100%', border: 'none' }}
                sandbox="allow-scripts allow-same-origin allow-forms"
                allow="geolocation"
                title="MCP App View"
              />
            </div>
          </div>
        ) : (
          <div
            className="bubble bot-bubble"
            dangerouslySetInnerHTML={{ __html: renderedHtml! }}
          />
        )}
      </div>
    </div>
  );
}
