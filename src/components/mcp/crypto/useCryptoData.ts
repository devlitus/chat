import { useState, useEffect, useCallback } from 'react';

interface CoinData {
  id: string; name: string; symbol: string; price: number; change24h: number;
}

type Status = 'loading' | 'success' | 'error';
type ErrorCode = 'rate-limited' | 'timeout' | 'network-error' | 'service-error' | 'unknown';

const ERROR_INFO: Record<ErrorCode, { icon: string; title: string; detail: string }> = {
  'rate-limited':  { icon: 'timer',       title: 'Rate limit alcanzado',     detail: 'Demasiadas peticiones a CoinGecko.' },
  'timeout':       { icon: 'timer_off',   title: 'Tiempo de espera agotado', detail: 'La API tardó demasiado en responder.' },
  'network-error': { icon: 'wifi_off',    title: 'Sin conexión',             detail: 'Verifica tu conexión a internet.' },
  'service-error': { icon: 'cloud_off',   title: 'Servicio no disponible',   detail: 'CoinGecko está caído o en mantenimiento.' },
  'unknown':       { icon: 'error',       title: 'Error desconocido',        detail: 'Inténtalo de nuevo.' },
};

export function useCryptoData() {
  const [status, setStatus] = useState<Status>('loading');
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [errorCode, setErrorCode] = useState<ErrorCode>('unknown');
  const [retryIn, setRetryIn] = useState<number | null>(null);

  const fetchPrices = useCallback(() => {
    setStatus('loading'); setCoins([]); setRetryIn(null);
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'mcp_call_tool', toolName: 'get-crypto-price' }, document.referrer || window.location.origin);
    } else { setErrorCode('unknown'); setStatus('error'); }
  }, []);

  useEffect(() => {
    if (retryIn === null) return;
    if (retryIn === 0) { fetchPrices(); return; }
    const t = setTimeout(() => setRetryIn(r => r !== null ? r - 1 : null), 1000);
    return () => clearTimeout(t);
  }, [retryIn, fetchPrices]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const d = event.data;
      if (!d || typeof d !== 'object') return;
      if (d.source && typeof d.source === 'string' && d.source.includes('devtools')) return;
      if (d.type === 'mcp_tool_result' && d.toolName === 'get-crypto-price') {
        if (d.error) {
          const code: ErrorCode = d.error in ERROR_INFO ? d.error : 'unknown';
          setErrorCode(code); setStatus('error');
          if (code === 'rate-limited') setRetryIn(15);
        } else if (Array.isArray(d.data)) { setCoins(d.data); setStatus('success'); }
        else { setErrorCode('unknown'); setStatus('error'); }
      }
    };
    window.addEventListener('message', handler);
    fetchPrices();
    return () => window.removeEventListener('message', handler);
  }, [fetchPrices]);

  return { status, coins, errorCode, retryIn, fetchPrices, ERROR_INFO };
}
