import { useChartData } from './chart/useChartData';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts';

const styleId = '__chart-widget-keyframes';
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `@keyframes chart-spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}

const s = {
  wrapper: {
    height: '100vh',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '12px',
    background: 'transparent',
    fontFamily: "'Inter', sans-serif",
    overflow: 'hidden',
  } as React.CSSProperties,
  card: {
    position: 'relative' as const,
    width: '100%',
    height: '100%',
    background: '#0b1221',
    borderRadius: '24px',
    padding: '3px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  inner: {
    background: '#0f1523',
    borderRadius: '21.6px',
    padding: '20px',
    position: 'relative' as const,
    overflow: 'hidden',
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '16px',
    flexShrink: 0,
    position: 'relative' as const,
    zIndex: 10,
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
    background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
  },
  iconLarge: { fontSize: '28px' },
  titleGradient: {
    fontSize: '20px',
    fontWeight: 700,
    lineHeight: 1.25,
    margin: 0,
    background: 'linear-gradient(to right, #93c5fd, #c4b5fd)',
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
  centerContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    position: 'relative' as const,
    zIndex: 10,
  },
  spinner: {
    color: '#60a5fa',
    fontSize: '40px',
    animation: 'chart-spin 1s linear infinite',
  },
  loadingText: { color: '#9ca3af', fontSize: '14px', fontWeight: 500, margin: 0 },
  errorIcon: { color: '#fb7185', fontSize: '40px', marginBottom: '8px' },
  errorTitle: { color: '#fff', fontSize: '14px', fontWeight: 500, margin: 0 },
  chartContainer: {
    flex: 1,
    position: 'relative' as const,
    zIndex: 10,
    marginTop: '8px',
  },
  glowBlue: {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    width: '256px',
    height: '256px',
    background: 'rgba(59,130,246,0.05)',
    borderRadius: '50%',
    filter: 'blur(64px)',
    transform: 'translate(33%, -50%)',
    pointerEvents: 'none' as const,
  },
  glowPurple: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    width: '192px',
    height: '192px',
    background: 'rgba(139,92,246,0.05)',
    borderRadius: '50%',
    filter: 'blur(64px)',
    transform: 'translate(-33%, 33%)',
    pointerEvents: 'none' as const,
  },
};

export default function ChartApp() {
  const { data, errorMsg, loading } = useChartData();

  let xAxisKey = 'name';
  const numericKeys: string[] = [];
  if (data && data.length > 0) {
    const sample = data[0];
    let foundX = false;
    for (const key of Object.keys(sample)) {
      if (!foundX && (key === 'name' || typeof sample[key] === 'string')) { xAxisKey = key; foundX = true; }
      else if (typeof sample[key] === 'number') numericKeys.push(key);
    }
    if (numericKeys.length === 0 && 'value' in sample) numericKeys.push('value');
  }

  const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

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
              {mi('bar_chart', s.iconLarge)}
            </div>
            <div>
              <h2 style={s.titleGradient}>Gráfico Dinámico</h2>
              <p style={s.subtitle}>Generado a partir de la conversación</p>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div style={s.centerContainer}>
              {mi('autorenew', s.spinner)}
              <p style={s.loadingText}>Procesando datos...</p>
            </div>
          )}

          {/* Error */}
          {!loading && errorMsg && (
            <div style={{ ...s.centerContainer, padding: '0 16px' }}>
              {mi('error', s.errorIcon)}
              <p style={s.errorTitle}>{errorMsg}</p>
            </div>
          )}

          {/* Chart */}
          {!loading && !errorMsg && data && data.length > 0 && (
            <div style={s.chartContainer}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    {colors.map((color, i) => (
                      <linearGradient key={`grad-${i}`} id={`chartColorGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                        <stop offset="95%" stopColor={color} stopOpacity={0.2} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey={xAxisKey} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} width={60} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                    contentStyle={{
                      backgroundColor: 'rgba(15, 21, 35, 0.9)',
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      color: '#fff',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    }}
                    itemStyle={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}
                  />
                  {numericKeys.map((key, i) => (
                    <Bar key={key} dataKey={key} fill={`url(#chartColorGrad${i % colors.length})`} radius={[6, 6, 0, 0]} barSize={40}>
                      {data.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={`url(#chartColorGrad${(index + i) % colors.length})`} />
                      ))}
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Decorative */}
          <div style={s.glowBlue}></div>
          <div style={s.glowPurple}></div>
        </div>
      </div>
    </div>
  );
}
