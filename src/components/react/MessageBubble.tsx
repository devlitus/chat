// src/components/react/MessageBubble.tsx

import { useMemo, useEffect, useRef, useCallback } from 'react';
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
  const bubbleRef = useRef<HTMLDivElement>(null);

  const renderedHtml = useMemo(() => {
    if (message.role === 'assistant') {
      return renderMarkdown(message.content);
    }
    return null;
  }, [message.content, message.role]);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleCopy = useCallback((e: MouseEvent) => {
    const btn = (e.target as HTMLElement).closest('.copy-btn') as HTMLButtonElement | null;
    if (!btn) return;
    const code = decodeURIComponent(btn.dataset.code ?? '');
    navigator.clipboard.writeText(code).then(() => {
      const icon = btn.querySelector('.material-symbols-outlined')!;
      const prev = icon.textContent;
      icon.textContent = 'check';
      btn.style.color = '#3fb950';
      setTimeout(() => { icon.textContent = prev; btn.style.color = ''; }, 1500);
    });
  }, []);

  useEffect(() => {
    const el = bubbleRef.current;
    if (!el) return;
    el.addEventListener('click', handleCopy);
    return () => el.removeEventListener('click', handleCopy);
  }, [handleCopy]);

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

      if (data && data.type === 'mcp_call_tool' && data.toolName === 'get-crypto-price') {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true',
          { signal: controller.signal }
        )
          .then((res) => {
            clearTimeout(timeout);
            if (res.status === 429) throw Object.assign(new Error(), { code: 'rate-limited' });
            if (!res.ok) throw Object.assign(new Error(), { code: 'service-error' });
            return res.json();
          })
          .then((json: Record<string, { usd: number; usd_24h_change: number }>) => {
            const coins = Object.entries(json).map(([id, values]) => ({
              id,
              name: id.charAt(0).toUpperCase() + id.slice(1),
              symbol: id === 'bitcoin' ? 'BTC' : id === 'ethereum' ? 'ETH' : 'SOL',
              price: values.usd,
              change24h: values.usd_24h_change,
            }));
            iframeRef.current?.contentWindow?.postMessage({
              type: 'mcp_tool_result',
              toolName: 'get-crypto-price',
              data: coins,
            }, '*');
          })
          .catch((err) => {
            clearTimeout(timeout);
            const code = err.name === 'AbortError' ? 'timeout' : (err.code ?? 'network-error');
            iframeRef.current?.contentWindow?.postMessage({
              type: 'mcp_tool_result',
              toolName: 'get-crypto-price',
              error: code,
            }, '*');
          });
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
          <div style={{ width: '360px', height: '480px' }}>
            <iframe
              ref={iframeRef}
              src={window.location.origin + message.uiResourceUri.replace('ui://mcp-app-demo', '')}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              sandbox="allow-scripts allow-same-origin allow-forms"
              allow="geolocation"
              title="MCP Widget"
            />
          </div>
        ) : (
          <div
            ref={bubbleRef}
            className="bubble bot-bubble"
            dangerouslySetInnerHTML={{ __html: renderedHtml! }}
          />
        )}
      </div>
    </div>
  );
}
