import { useEffect } from 'react';
import { useWeatherData } from './weather/useWeatherData';

const styleId = '__weather-widget-keyframes';
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `@keyframes weather-spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}

function getWeatherInfo(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: 'sunny', label: 'Despejado' };
  if (code >= 1 && code <= 3) return { icon: 'partly_cloudy_day', label: 'Parcialmente nublado' };
  if (code >= 45 && code <= 48) return { icon: 'foggy', label: 'Niebla' };
  if (code >= 51 && code <= 55) return { icon: 'grain', label: 'Llovizna' };
  if (code >= 61 && code <= 65) return { icon: 'rainy', label: 'Lluvia' };
  if (code >= 71 && code <= 75) return { icon: 'ac_unit', label: 'Nieve' };
  if (code >= 80 && code <= 82) return { icon: 'rainy', label: 'Chubascos' };
  if (code >= 95 && code <= 99) return { icon: 'thunderstorm', label: 'Tormenta' };
  return { icon: 'partly_cloudy_day', label: 'Desconocido' };
}

const styles = {
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
  iconLarge: {
    fontSize: '28px',
  },
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
  errorContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '12px',
    padding: '24px 0',
    textAlign: 'center' as const,
  },
  errorTitle: {
    color: '#9ca3af',
    fontSize: '14px',
    fontWeight: 500,
    margin: 0,
  },
  errorSub: {
    color: '#4b5563',
    fontSize: '12px',
    margin: 0,
  },
  locationRow: {
    background: '#080c14',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '16px',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  cityText: {
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  tempRow: {
    background: '#080c14',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '16px',
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tempLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  weatherIcon: {
    fontSize: '44px',
    color: '#22d3ee',
  },
  tempValue: {
    fontSize: '36px',
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1,
    margin: 0,
  },
  tempLabel: {
    color: '#6b7280',
    fontSize: '14px',
    margin: '4px 0 0',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  statBox: {
    background: '#080c14',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '16px',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statIcon: {
    fontSize: '20px',
    color: '#22d3ee',
  },
  statLabel: {
    fontSize: '12px',
    color: '#4b5563',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    margin: 0,
  },
  statValue: {
    color: '#fff',
    fontWeight: 600,
    fontSize: '14px',
    margin: 0,
  },
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
  spin: {
    animation: 'weather-spin 1s linear infinite',
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
  iconRed: {
    fontSize: '36px',
    color: '#f87171',
  },
};

export default function WeatherApp() {
  const { status, weather, fetchWeather } = useWeatherData();
  useEffect(() => { fetchWeather(); }, [fetchWeather]);

  const weatherInfo = weather ? getWeatherInfo(weather.weatherCode) : null;

  const materialIcon = (name: string, style?: React.CSSProperties) => (
    <span className="material-symbols-rounded" style={style}>{name}</span>
  );

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.inner}>
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.iconBox}>
              {materialIcon('wb_sunny', styles.iconLarge)}
            </div>
            <div>
              <h2 style={styles.titleGradient}>Clima Actual</h2>
              <p style={styles.subtitle}>Open-Meteo · BigDataCloud</p>
            </div>
          </div>

          {/* Loading */}
          {status === 'loading' && (
            <div style={styles.loadingContainer}>
              {materialIcon('sync', { ...styles.weatherIcon, ...styles.spin, fontSize: '36px' })}
              <p style={styles.loadingText}>Obteniendo ubicación y clima...</p>
            </div>
          )}

          {/* Geo Error */}
          {status === 'geo-error' && (
            <div style={styles.errorContainer}>
              {materialIcon('location_off', styles.iconRed)}
              <p style={styles.errorTitle}>No se pudo obtener la ubicación.</p>
              <p style={styles.errorSub}>Permite el acceso a la geolocalización.</p>
            </div>
          )}

          {/* Fetch Error */}
          {status === 'fetch-error' && (
            <div style={styles.errorContainer}>
              {materialIcon('cloud_off', { ...styles.iconRed, fontSize: '36px' })}
              <p style={styles.errorTitle}>No se pudo obtener el clima.</p>
              <p style={styles.errorSub}>Verifica tu conexión a internet.</p>
            </div>
          )}

          {/* Success */}
          {status === 'success' && weather && weatherInfo && (
            <div style={{ marginBottom: '20px' }}>
              {/* City */}
              <div style={{ ...styles.locationRow, marginBottom: '10px' }}>
                {materialIcon('location_on', styles.statIcon)}
                <p style={styles.cityText}>{weather.city}</p>
              </div>

              {/* Temperature */}
              <div style={{ ...styles.tempRow, marginBottom: '10px' }}>
                <div style={styles.tempLeft}>
                  {materialIcon(weatherInfo.icon, styles.weatherIcon)}
                  <div>
                    <p style={styles.tempValue}>{weather.temperature}°C</p>
                    <p style={styles.tempLabel}>{weatherInfo.label}</p>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div style={styles.statsGrid}>
                <div style={styles.statBox}>
                  {materialIcon('air', styles.statIcon)}
                  <div>
                    <p style={styles.statLabel}>Viento</p>
                    <p style={styles.statValue}>{weather.windSpeed} km/h</p>
                  </div>
                </div>
                <div style={styles.statBox}>
                  {materialIcon('water_drop', styles.statIcon)}
                  <div>
                    <p style={styles.statLabel}>Humedad</p>
                    <p style={styles.statValue}>{weather.humidity}%</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Refresh Button */}
          <div style={styles.btnWrapper}
            onMouseEnter={(e) => {
              const glow = e.currentTarget.querySelector('[data-glow]') as HTMLElement;
              if (glow) glow.style.opacity = '0.4';
            }}
            onMouseLeave={(e) => {
              const glow = e.currentTarget.querySelector('[data-glow]') as HTMLElement;
              if (glow) glow.style.opacity = '0.2';
            }}
          >
            <div data-glow style={styles.btnGlow}></div>
            <button
              onClick={fetchWeather}
              disabled={status === 'loading'}
              style={{
                ...styles.btn,
                ...(status === 'loading' ? styles.btnDisabled : {}),
              }}
            >
              <span className="material-symbols-rounded" style={{
                fontSize: '20px',
                ...(status === 'loading' ? styles.spin : {}),
              }}>
                refresh
              </span>
              <span>{status === 'loading' ? 'Actualizando...' : 'Actualizar'}</span>
            </button>
          </div>

          {/* Decorative glows */}
          <div style={styles.glowBlue}></div>
          <div style={styles.glowPurple}></div>
        </div>
      </div>
    </div>
  );
}
