import { useEffect, useRef, useCallback } from 'react';
import type { Message } from '../../../lib/db';
import { registerIframeHandler } from '../../../lib/iframe-message-bus';

export function useMcpTools(iframeRef: React.RefObject<HTMLIFrameElement | null>, message: Message) {
  const messageRef = useRef(message);
  messageRef.current = message;

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
    const iframe = iframeRef.current;
    if (!iframe) return;

    const buildHandler = (iframeEl: HTMLIFrameElement) => (data: unknown) => {
      const msg = data as { type?: string; toolName?: string };
      if (!msg || msg.type !== 'mcp_call_tool') return;

      if (msg.toolName === 'get-time') {
        iframeEl.contentWindow?.postMessage({
          type: 'mcp_tool_result', toolName: 'get-time', time: new Date().toISOString(),
        }, window.location.origin);
      }

      if (msg.toolName === 'get-location') {
        navigator.geolocation.getCurrentPosition(
          (pos) => iframeEl.contentWindow?.postMessage({
            type: 'mcp_tool_result', toolName: 'get-location',
            latitude: pos.coords.latitude, longitude: pos.coords.longitude,
          }, window.location.origin),
          () => iframeEl.contentWindow?.postMessage({
            type: 'mcp_tool_result', toolName: 'get-location', error: 'permission-denied',
          }, window.location.origin)
        );
      }

      if (msg.toolName === 'get-crypto-price') {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true', { signal: controller.signal })
          .then((res) => { clearTimeout(timeout); if (res.status === 429) throw Object.assign(new Error(), { code: 'rate-limited' }); if (!res.ok) throw Object.assign(new Error(), { code: 'service-error' }); return res.json(); })
          .then((json: Record<string, { usd: number; usd_24h_change: number }>) => {
            const coins = Object.entries(json).map(([id, v]) => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1), symbol: id === 'bitcoin' ? 'BTC' : id === 'ethereum' ? 'ETH' : 'SOL', price: v.usd, change24h: v.usd_24h_change }));
            iframeEl.contentWindow?.postMessage({ type: 'mcp_tool_result', toolName: 'get-crypto-price', data: coins }, window.location.origin);
          })
          .catch((err) => { clearTimeout(timeout); iframeEl.contentWindow?.postMessage({ type: 'mcp_tool_result', toolName: 'get-crypto-price', error: err.name === 'AbortError' ? 'timeout' : (err.code ?? 'network-error') }, window.location.origin); });
      }

      if (msg.toolName === 'get-chart-data') {
        const match = messageRef.current.content.match(/<chart-data>([\s\S]*?)<\/chart-data>/);
        let chartData = null;
        if (match) { try { chartData = JSON.parse(match[1]); } catch { /* ignore */ } }
        iframeEl.contentWindow?.postMessage({ type: 'mcp_tool_result', toolName: 'get-chart-data', data: chartData }, window.location.origin);
      }
    };

    let cleanup: (() => void) | undefined;
    const onLoad = () => {
      if (!iframe.contentWindow) return;
      cleanup = registerIframeHandler(iframe.contentWindow, buildHandler(iframe));
    };

    if (iframe.contentDocument?.readyState === 'complete') { onLoad(); return () => cleanup?.(); }
    iframe.addEventListener('load', onLoad);
    return () => { iframe.removeEventListener('load', onLoad); cleanup?.(); };
  }, [iframeRef]);

  return { handleCopy };
}
