import { useCryptoData } from './crypto/useCryptoData';

const styleId = '__crypto-widget-keyframes';
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `@keyframes crypto-spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}

const COIN_META: Record<string, { label: string; symbol: string; icon: string }> = {
  bitcoin:  { label: 'Bitcoin',  symbol: 'BTC', icon: 'currency_bitcoin' },
  ethereum: { label: 'Ethereum', symbol: 'ETH', icon: 'diamond' },
  solana:   { label: 'Solana',   symbol: 'SOL', icon: 'bolt' },
};

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: price < 10 ? 4 : 2,
  }).format(price);
}

const s = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '12px 12px 0',
    background: 'transparent',
    fontFamily: "'Inter', sans-serif",
  } as React.CSSProperties,
  card: {
    position: 'relative' as const,
    width: '100%',
    maxWidth: '384px',
    background: '#0b1221',
    borderRadius: '24px',
    padding: '3px',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  inner: {
    background: '#0f1523',
    borderRadius: '21.6px',
    padding: '20px',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '20px',
  },
  iconBox: {
    width: '48px',
    height: '48px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    boxShadow: '0 4px 6px -1px rgba(59,130,246,0.2)',
    flexShrink: 0,
    background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)',
  },
  iconLarge: { fontSize: '28px' },
  titleGradient: {
    fontSize: '20px',
    fontWeight: 700,
    lineHeight: 1.25,
    margin: 0,
    background: 'linear-gradient(to right, #60a5fa, #22d3ee)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  } as React.CSSProperties,
  subtitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#6b7280',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    margin: '2px 0 0',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '12px',
    padding: '32px 0',
  },
  loadingText: {
    color: '#6b7280',
    fontSize: '14px',
    margin: 0,
  },
  spin: { animation: 'crypto-spin 1s linear infinite' },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '12px',
    padding: '24px 0',
    textAlign: 'center' as const,
    marginBottom: '8px',
  },
  errorIconBox: {
    width: '48px',
    height: '48px',
    borderRadius: '16px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIcon: { fontSize: '24px', color: '#f87171' },
  errorTitle: { color: '#d1d5db', fontSize: '14px', fontWeight: 600, margin: 0 },
  errorDetail: { color: '#4b5563', fontSize: '12px', margin: '4px 0 0' },
  retryBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#080c14',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '12px',
    padding: '8px 16px',
    marginTop: '4px',
  },
  retryText: { fontSize: '12px', color: '#9ca3af', margin: 0 },
  retryHighlight: { color: '#22d3ee', fontWeight: 700 } as React.CSSProperties,
  coinList: { marginBottom: '20px' },
  coinItem: {
    background: '#080c14',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '16px',
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    transition: 'all 0.2s',
    cursor: 'pointer',
  },
  coinLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  coinIcon: { fontSize: '28px', color: '#22d3ee' },
  coinName: { color: '#fff', fontWeight: 700, fontSize: '14px', margin: 0, lineHeight: 1 },
  coinSymbol: { color: '#6b7280', fontSize: '12px', fontWeight: 500, margin: '2px 0 0', display: 'block' as const },
  coinRight: { textAlign: 'right' as const },
  coinPrice: { color: '#fff', fontWeight: 700, fontSize: '18px', letterSpacing: '-0.025em', lineHeight: 1, margin: 0 },
  coinChange: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '2px',
    fontSize: '12px',
    fontWeight: 700,
    marginTop: '2px',
  } as React.CSSProperties,
  coinChangeIcon: { fontSize: '16px', lineHeight: 1 },
  btnWrapper: {
    position: 'relative' as const,
    marginTop: '20px',
  },
  btnGlow: {
    position: 'absolute' as const,
    inset: '-2px',
    background: 'linear-gradient(to right, #3b82f6, #22d3ee)',
    borderRadius: '12px',
    filter: 'blur(4px)',
    opacity: 0.2,
    transition: 'opacity 0.2s',
    pointerEvents: 'none' as const,
  },
  btn: {
    position: 'relative' as const,
    width: '100%',
    background: 'rgba(30,41,59,0.5)',
    color: '#fff',
    padding: '14px 16px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
    cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '0.025em',
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,
  btnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  } as React.CSSProperties,
  glowBlue: {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    width: '256px',
    height: '256px',
    background: 'rgba(59,130,246,0.05)',
    borderRadius: '50%',
    filter: 'blur(64px)',
    transform: 'translate(50%, -50%)',
    pointerEvents: 'none' as const,
  },
  glowPurple: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    width: '192px',
    height: '192px',
    background: 'rgba(168,85,247,0.05)',
    borderRadius: '50%',
    filter: 'blur(64px)',
    transform: 'translate(-33%, 50%)',
    pointerEvents: 'none' as const,
  },
};

export default function CryptoApp() {
  const { status, coins, errorCode, retryIn, fetchPrices, ERROR_INFO } = useCryptoData();

  const mi = (name: string, style?: React.CSSProperties) => (
    <span className="material-symbols-rounded" style={style}>{name}</span>
  );

  return (
    <div style={s.wrapper}>
      <div style={s.card}>
        <div style={s.inner}>
          {/* Header */}
          <div style={s.header}>
            <div style={s.iconBox}>
              {mi('currency_bitcoin', s.iconLarge)}
            </div>
            <div>
              <h2 style={s.titleGradient}>Crypto Prices</h2>
              <p style={s.subtitle}>Coingecko API</p>
            </div>
          </div>

          {/* Loading */}
          {status === 'loading' && (
            <div style={s.loadingContainer}>
              {mi('sync', { color: '#22d3ee', fontSize: '36px', animation: 'crypto-spin 1s linear infinite' })}
              <p style={s.loadingText}>Obteniendo precios...</p>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (() => {
            const info = ERROR_INFO[errorCode];
            return (
              <div style={s.errorContainer}>
                <div style={s.errorIconBox}>
                  {mi(info.icon, s.errorIcon)}
                </div>
                <div>
                  <p style={s.errorTitle}>{info.title}</p>
                  <p style={s.errorDetail}>{info.detail}</p>
                </div>
                {errorCode === 'rate-limited' && retryIn !== null && (
                  <div style={s.retryBadge}>
                    {mi('sync', { color: '#22d3ee', fontSize: '16px', animation: 'crypto-spin 1s linear infinite' })}
                    <p style={s.retryText}>
                      Reintentando en{' '}
                      <span style={s.retryHighlight}>{retryIn}s</span>
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Success */}
          {status === 'success' && coins.length > 0 && (
            <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {coins.map((coin) => {
                const meta = COIN_META[coin.id] ?? { label: coin.name, symbol: coin.symbol, icon: 'toll' };
                const isPos = coin.change24h >= 0;
                return (
                  <div
                    key={coin.id}
                    style={s.coinItem}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#0d121c'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#080c14'; }}
                  >
                    <div style={s.coinLeft}>
                      <div>{mi(meta.icon, s.coinIcon)}</div>
                      <div>
                        <h4 style={s.coinName}>{meta.label}</h4>
                        <span style={s.coinSymbol}>{meta.symbol}</span>
                      </div>
                    </div>
                    <div style={s.coinRight}>
                      <div style={s.coinPrice}>{formatPrice(coin.price)}</div>
                      <div style={{ ...s.coinChange, color: isPos ? '#34d399' : '#f87171' }}>
                        {mi(isPos ? 'arrow_drop_up' : 'arrow_drop_down', s.coinChangeIcon)}
                        {Math.abs(coin.change24h).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Refresh Button */}
          <div style={s.btnWrapper}
            onMouseEnter={(e) => {
              const g = e.currentTarget.querySelector('[data-glow]') as HTMLElement;
              if (g) g.style.opacity = '0.4';
            }}
            onMouseLeave={(e) => {
              const g = e.currentTarget.querySelector('[data-glow]') as HTMLElement;
              if (g) g.style.opacity = '0.2';
            }}
          >
            <div data-glow style={s.btnGlow}></div>
            <button
              onClick={fetchPrices}
              disabled={status === 'loading' || retryIn !== null}
              style={{
                ...s.btn,
                ...(status === 'loading' || retryIn !== null ? s.btnDisabled : {}),
              }}
            >
              <span className="material-symbols-rounded" style={{
                fontSize: '20px',
                ...(status === 'loading' ? s.spin : {}),
              }}>
                refresh
              </span>
              <span>
                {status === 'loading'
                  ? 'Actualizando...'
                  : retryIn !== null
                    ? `Reintentando en ${retryIn}s`
                    : 'Actualizar Precios'}
              </span>
            </button>
          </div>

          {/* Decorative glows */}
          <div style={s.glowBlue}></div>
          <div style={s.glowPurple}></div>
        </div>
      </div>
    </div>
  );
}
