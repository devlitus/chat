import { useMcpTime } from './useMcpTime';

const styleId = '__mcpclient-widget-keyframes';
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `@keyframes mcpclient-spin { to { transform: rotate(360deg); } } @keyframes mcpclient-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`;
  document.head.appendChild(style);
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
  sectionLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#4b5563',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    marginBottom: '12px',
    paddingLeft: '4px',
  },
  timeBox: {
    background: '#080c14',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '88px',
  },
  timeCode: {
    fontFamily: "'ui-monospace', 'SFMono-Regular', 'SF Mono', 'Menlo', 'Consolas', monospace",
    fontSize: '30px',
    letterSpacing: '0.1em',
    fontWeight: 700,
    transition: 'all 0.3s',
  } as React.CSSProperties,
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
  btnDisabled: { opacity: 0.6, cursor: 'not-allowed' } as React.CSSProperties,
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

export default function McpClientApp() {
  const { serverTime, isFetching, handleSync } = useMcpTime();

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
              {mi('schedule', s.iconLarge)}
            </div>
            <div>
              <h2 style={s.titleGradient}>Live Sync</h2>
              <p style={s.subtitle}>MCP Tool Demo</p>
            </div>
          </div>

          {/* Server Time */}
          <div style={{ marginBottom: '20px' }}>
            <p style={s.sectionLabel}>Tiempo del Servidor</p>
            <div style={s.timeBox}>
              <code
                style={{
                  ...s.timeCode,
                  color: isFetching ? '#22d3ee' : '#fff',
                  animation: isFetching ? 'mcpclient-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
                }}
              >
                {serverTime}
              </code>
            </div>
          </div>

          {/* Sync Button */}
          <div style={s.btnWrapper}
            onMouseEnter={(e) => { const g = e.currentTarget.querySelector('[data-glow]') as HTMLElement; if (g) g.style.opacity = '0.4'; }}
            onMouseLeave={(e) => { const g = e.currentTarget.querySelector('[data-glow]') as HTMLElement; if (g) g.style.opacity = '0.2'; }}
          >
            <div data-glow style={s.btnGlow}></div>
            <button
              onClick={handleSync}
              disabled={isFetching}
              style={{
                ...s.btn,
                ...(isFetching ? s.btnDisabled : {}),
              }}
            >
              <span className="material-symbols-rounded" style={{
                fontSize: '20px',
                animation: isFetching ? 'mcpclient-spin 1s linear infinite' : 'none',
              }}>
                sync
              </span>
              <span>{isFetching ? 'Actualizando...' : 'Sincronizar Ahora'}</span>
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
