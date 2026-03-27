// src/components/react/MessageBubble.tsx

import { useMemo, useEffect, useRef, useCallback } from 'react';
import type { Message } from '../../lib/db';
import { renderMarkdown } from '../../lib/markdown';
import { registerIframeHandler } from '../../lib/iframe-message-bus';

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
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Handler de despacho por toolName — se registra cuando el iframe este listo
    const buildHandler = (iframeEl: HTMLIFrameElement) => (data: unknown) => {
      const msg = data as { type?: string; toolName?: string };
      if (!msg || msg.type !== 'mcp_call_tool') return;

      if (msg.toolName === 'get-time') {
        const timeResult = new Date().toISOString();
        iframeEl.contentWindow?.postMessage({
          type: 'mcp_tool_result',
          toolName: 'get-time',
          time: timeResult,
        }, window.location.origin);
      }

      if (msg.toolName === 'get-location') {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            iframeEl.contentWindow?.postMessage({
              type: 'mcp_tool_result',
              toolName: 'get-location',
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }, window.location.origin);
          },
          () => {
            iframeEl.contentWindow?.postMessage({
              type: 'mcp_tool_result',
              toolName: 'get-location',
              error: 'permission-denied',
            }, window.location.origin);
          }
        );
      }

      if (msg.toolName === 'get-crypto-price') {
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
            iframeEl.contentWindow?.postMessage({
              type: 'mcp_tool_result',
              toolName: 'get-crypto-price',
              data: coins,
            }, window.location.origin);
          })
          .catch((err) => {
            clearTimeout(timeout);
            const code = err.name === 'AbortError' ? 'timeout' : (err.code ?? 'network-error');
            iframeEl.contentWindow?.postMessage({
              type: 'mcp_tool_result',
              toolName: 'get-crypto-price',
              error: code,
            }, window.location.origin);
          });
      }
      if (msg.toolName === 'get-chart-data') {
        const match = message.content.match(/<chart-data>([\s\S]*?)<\/chart-data>/);
        let chartData = null;
        if (match) {
          try {
            chartData = JSON.parse(match[1]);
          } catch (e) {
            console.error('Failed to parse chart-data JSON:', e);
          }
        }
        iframeEl.contentWindow?.postMessage({
          type: 'mcp_tool_result',
          toolName: 'get-chart-data',
          data: chartData,
        }, window.location.origin);
      }
    };

    // Registrar en el evento load para garantizar que contentWindow este disponible
    let cleanup: (() => void) | undefined;

    const onLoad = () => {
      const iframeWindow = iframe.contentWindow;
      if (!iframeWindow) return;
      cleanup = registerIframeHandler(iframeWindow, buildHandler(iframe));
    };

    // Si el iframe ya cargo (efecto ejecutado tarde), registrar directamente
    if (iframe.contentDocument?.readyState === 'complete') {
      onLoad();
      return () => cleanup?.();
    }

    // Esperar el evento load del iframe
    iframe.addEventListener('load', onLoad);
    return () => {
      iframe.removeEventListener('load', onLoad);
      cleanup?.();
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
        {(() => {
          if (message.uiResourceUri) {
            const ALLOWED_UI_PATHS = ['/mcp-app', '/crypto-app', '/weather-app', '/travel-app', '/chart-app'];
            const uiPath = message.uiResourceUri.replace('ui://mcp-app-demo', '');
            if (ALLOWED_UI_PATHS.some(p => uiPath.startsWith(p))) {
              const iframeSrc = window.location.origin + uiPath;
              const iframeTitle =
                uiPath.startsWith('/weather-app') ? 'Widget de clima' :
                  uiPath.startsWith('/crypto-app') ? 'Widget de criptomonedas' :
                    uiPath.startsWith('/travel-app') ? 'Widget de viajes' :
                      uiPath.startsWith('/chart-app') ? 'Widget de gráfico' :
                        'Widget MCP';
              const iframeHeight = uiPath.startsWith('/travel-app') ? '520px' : uiPath.startsWith('/chart-app') ? '450px' : '480px';
              const iframeWidth = uiPath.startsWith('/travel-app') ? '640px' : uiPath.startsWith('/chart-app') ? '640px' : '360px';
              return (
                <div style={{ width: iframeWidth, height: iframeHeight }}>
                  <iframe
                    ref={iframeRef}
                    src={iframeSrc}
                    style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                    sandbox="allow-scripts allow-same-origin allow-forms"
                    allow="geolocation"
                    title={iframeTitle}
                  />
                </div>
              );
            }
          }
          return (
            <div
              ref={bubbleRef}
              className="bubble bot-bubble"
              dangerouslySetInnerHTML={{ __html: renderedHtml! }}
            />
          );
        })()}
      </div>
    </div>
  );
}
