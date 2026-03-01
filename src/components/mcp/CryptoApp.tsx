import { useEffect, useState, useCallback } from 'react';

interface CoinData {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
}

type FetchStatus = 'loading' | 'success' | 'error';
type ErrorCode = 'rate-limited' | 'timeout' | 'network-error' | 'service-error' | 'unknown';

const ERROR_INFO: Record<ErrorCode, { icon: string; title: string; detail: string }> = {
  'rate-limited':  { icon: 'timer',       title: 'Rate limit alcanzado',     detail: 'Demasiadas peticiones a CoinGecko.' },
  'timeout':       { icon: 'timer_off',   title: 'Tiempo de espera agotado', detail: 'La API tardó demasiado en responder.' },
  'network-error': { icon: 'wifi_off',    title: 'Sin conexión',             detail: 'Verifica tu conexión a internet.' },
  'service-error': { icon: 'cloud_off',   title: 'Servicio no disponible',   detail: 'CoinGecko está caído o en mantenimiento.' },
  'unknown':       { icon: 'error',       title: 'Error desconocido',        detail: 'Inténtalo de nuevo.' },
};

const COIN_META: Record<string, { label: string; symbol: string; icon: string }> = {
  bitcoin:  { label: 'Bitcoin',  symbol: 'BTC', icon: 'currency_bitcoin' },
  ethereum: { label: 'Ethereum', symbol: 'ETH', icon: 'diamond' },
  solana:   { label: 'Solana',   symbol: 'SOL', icon: 'bolt' },
};

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: price < 10 ? 4 : 2,
  }).format(price);
}

export default function CryptoApp() {
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [errorCode, setErrorCode] = useState<ErrorCode>('unknown');
  const [retryIn, setRetryIn] = useState<number | null>(null);

  const fetchPrices = useCallback(() => {
    setStatus('loading');
    setCoins([]);
    setRetryIn(null);
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'mcp_call_tool', toolName: 'get-crypto-price' }, '*');
    } else {
      setErrorCode('unknown');
      setStatus('error');
    }
  }, []);

  // Countdown auto-retry para rate limit
  useEffect(() => {
    if (retryIn === null) return;
    if (retryIn === 0) { fetchPrices(); return; }
    const t = setTimeout(() => setRetryIn(r => r !== null ? r - 1 : null), 1000);
    return () => clearTimeout(t);
  }, [retryIn, fetchPrices]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.source && typeof event.data.source === 'string' && event.data.source.includes('devtools')) return;
      const data = event.data;
      if (data.type === 'mcp_tool_result' && data.toolName === 'get-crypto-price') {
        if (data.error) {
          const code: ErrorCode = data.error in ERROR_INFO ? data.error : 'unknown';
          setErrorCode(code);
          setStatus('error');
          if (code === 'rate-limited') setRetryIn(15);
        } else if (Array.isArray(data.data)) {
          setCoins(data.data);
          setStatus('success');
        } else {
          setErrorCode('unknown');
          setStatus('error');
        }
      }
    };
    window.addEventListener('message', handleMessage);
    fetchPrices();
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchPrices]);

  return (
    <div className="min-h-screen flex items-start justify-center p-3 pt-3 bg-transparent font-sans">
      {/* Outer card */}
      <div className="relative w-full max-w-sm rounded-3xl p-[3px] shadow-xl border border-white/5 overflow-hidden">
        {/* Inner panel */}
        <div className="bg-[#0f1523] rounded-[1.35rem] p-5 relative overflow-hidden">

          {/* Header */}
          <div className="flex items-center gap-4 mb-5">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0"
              style={{ background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)' }}
            >
              <span className="material-symbols-rounded text-[28px]">currency_bitcoin</span>
            </div>
            <div>
              <h2
                className="text-xl font-bold leading-tight"
                style={{
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundImage: 'linear-gradient(to right, #60a5fa, #22d3ee)',
                }}
              >
                Crypto Prices
              </h2>
              <p className="text-xs font-semibold text-gray-500 tracking-wide uppercase mt-0.5">
                Coingecko API
              </p>
            </div>
          </div>

          {/* Loading */}
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <span className="material-symbols-rounded animate-spin text-[#22d3ee] text-[36px]">sync</span>
              <p className="text-gray-500 text-sm">Obteniendo precios...</p>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (() => {
            const info = ERROR_INFO[errorCode];
            return (
              <div className="flex flex-col items-center gap-3 py-6 text-center mb-2">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <span className="material-symbols-rounded text-red-400 text-[24px]">{info.icon}</span>
                </div>
                <div>
                  <p className="text-gray-300 text-sm font-semibold">{info.title}</p>
                  <p className="text-gray-600 text-xs mt-1">{info.detail}</p>
                </div>
                {errorCode === 'rate-limited' && retryIn !== null && (
                  <div className="flex items-center gap-2 bg-[#080c14] border border-white/5 rounded-xl px-4 py-2 mt-1">
                    <span className="material-symbols-rounded text-[#22d3ee] text-[16px] animate-spin">sync</span>
                    <span className="text-xs text-gray-400">
                      Reintentando en <span className="text-[#22d3ee] font-bold tabular-nums">{retryIn}s</span>
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Coin rows */}
          {status === 'success' && coins.length > 0 && (
            <div className="space-y-2.5 mb-5">
              {coins.map((coin) => {
                const meta = COIN_META[coin.id] ?? { label: coin.name, symbol: coin.symbol, icon: 'toll' };
                const isPos = coin.change24h >= 0;
                return (
                  <div
                    key={coin.id}
                    className="group bg-[#080c14] hover:bg-[#0d121c] border border-white/5 rounded-2xl p-4 flex items-center justify-between transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-[#22d3ee]">
                        <span className="material-symbols-rounded text-[28px]">{meta.icon}</span>
                      </div>
                      <div>
                        <h4 className="text-white font-bold text-sm leading-none">{meta.label}</h4>
                        <span className="text-xs text-gray-500 font-medium mt-0.5 block">{meta.symbol}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-bold text-lg tracking-tight leading-none">
                        {formatPrice(coin.price)}
                      </div>
                      <div className={`flex items-center justify-end gap-0.5 text-xs font-bold mt-0.5 ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                        <span className="material-symbols-rounded text-[16px] leading-none">
                          {isPos ? 'arrow_drop_up' : 'arrow_drop_down'}
                        </span>
                        {Math.abs(coin.change24h).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Refresh button — always visible */}
          <div className="relative group mt-5">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-200 pointer-events-none"></div>
            <button
              onClick={fetchPrices}
              disabled={status === 'loading' || retryIn !== null}
              className="relative w-full bg-[#1e293b]/50 hover:bg-[#1e293b] text-white py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 border border-white/10 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed font-sans"
            >
              <span className={`material-symbols-rounded text-[20px] ${status === 'loading' ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span className="font-bold text-sm tracking-wide uppercase">
                {status === 'loading' ? 'Actualizando...' : retryIn !== null ? `Reintentando en ${retryIn}s` : 'Actualizar Precios'}
              </span>
            </button>
          </div>

          {/* Background glow blobs */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none"></div>
        </div>
      </div>
    </div>
  );
}
