import { useTravelData } from './travel/useTravelData';
import { useStore } from '@nanostores/react';
import { $selectedProvider } from '../../stores/chat-store';

const styleId = '__travel-widget-keyframes';
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `@keyframes travel-spin { to { transform: rotate(360deg); } }`;
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
    maxWidth: '620px',
    height: '100%',
    background: '#0b1221',
    borderRadius: '24px',
    padding: '3px',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.05)',
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
    marginBottom: '20px',
    flexShrink: 0,
    position: 'relative' as const,
    zIndex: 10,
  },
  iconBoxTravel: {
    width: '48px',
    height: '48px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    boxShadow: '0 4px 6px -1px rgba(59,130,246,0.2)',
    flexShrink: 0,
    background: 'linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)',
  },
  iconLarge: { fontSize: '28px' },
  titleGradient: {
    fontSize: '20px',
    fontWeight: 700,
    lineHeight: 1.25,
    margin: 0,
    background: 'linear-gradient(to right, #fb7185, #fca5a5)',
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
  form: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    position: 'relative' as const,
    zIndex: 10,
  },
  formFields: {
    flex: 1,
    overflowY: 'auto' as const,
    paddingRight: '4px',
  },
  fieldGroup: { marginBottom: '12px' },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: '#9ca3af',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.025em',
    marginBottom: '6px',
    marginLeft: '4px',
  },
  inputWrapper: { position: 'relative' as const },
  inputIcon: {
    position: 'absolute' as const,
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#6b7280',
    fontSize: '20px',
  },
  input: {
    width: '100%',
    background: 'rgba(30,41,59,0.5)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '10px 16px 10px 40px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.2s',
    boxSizing: 'border-box' as const,
  },
  inputFocus: {
    borderColor: 'rgba(251,113,133,0.5)',
    background: '#1e293b',
  },
  select: {
    width: '100%',
    background: 'rgba(30,41,59,0.5)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '10px 16px 10px 40px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.2s',
    appearance: 'none' as const,
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%',
    background: 'rgba(30,41,59,0.5)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '10px 16px 10px 40px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.2s',
    resize: 'none' as const,
    boxSizing: 'border-box' as const,
    fontFamily: "'Inter', sans-serif",
  },
  textareaIcon: {
    position: 'absolute' as const,
    left: '12px',
    top: '12px',
    color: '#6b7280',
    fontSize: '20px',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginBottom: '12px',
  },
  btnWrapper: { position: 'relative' as const, flexShrink: 0, marginTop: '8px' },
  btnGlow: {
    position: 'absolute' as const,
    inset: '-2px',
    background: 'linear-gradient(to right, #f43f5e, #fb923c)',
    borderRadius: '12px',
    filter: 'blur(4px)',
    opacity: 0.3,
    transition: 'opacity 0.2s',
    pointerEvents: 'none' as const,
  },
  btnPrimary: {
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
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' } as React.CSSProperties,
  loadingContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '32px 0',
    position: 'relative' as const,
    zIndex: 10,
  },
  loadingRelative: { position: 'relative' as const },
  loadingSpinner: {
    color: '#fb7185',
    fontSize: '48px',
    animation: 'travel-spin 1s linear infinite',
  },
  loadingPlane: {
    position: 'absolute' as const,
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fdba74',
    fontSize: '24px',
  },
  loadingTitle: { color: '#fff', fontWeight: 600, fontSize: '16px', margin: 0 },
  loadingSub: { color: '#6b7280', fontSize: '14px', margin: '4px 0 0' },
  errorContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '32px 0',
    position: 'relative' as const,
    zIndex: 10,
    textAlign: 'center' as const,
  },
  errorIconBox: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'rgba(239,68,68,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIcon: { color: '#f87171', fontSize: '36px' },
  errorTitle: { color: '#fff', fontWeight: 600, fontSize: '18px', margin: 0 },
  errorMsg: { color: '#9ca3af', fontSize: '14px', margin: '4px 0 0' },
  retryBtn: {
    marginTop: '8px',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    padding: '8px 24px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.2s',
    fontFamily: "'Inter', sans-serif",
  },
  resultsContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'relative' as const,
    zIndex: 10,
    height: '100%',
    overflow: 'hidden',
  },
  resultsScroll: {
    flex: 1,
    overflowY: 'auto' as const,
    paddingRight: '4px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  resultCard: {
    background: 'rgba(30,41,59,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '16px',
    padding: '16px',
  },
  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '8px',
    marginBottom: '8px',
  },
  resultTitle: { color: '#fff', fontWeight: 700, fontSize: '14px', lineHeight: 1.25, margin: 0 },
  costBadge: {
    background: 'rgba(16,185,129,0.2)',
    color: '#6ee7b7',
    fontSize: '12px',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '9999px',
    flexShrink: 0,
  },
  resultDesc: { color: '#9ca3af', fontSize: '12px', lineHeight: 1.5, margin: '0 0 12px' },
  highlightTag: {
    background: 'rgba(255,255,255,0.05)',
    color: '#d1d5db',
    fontSize: '10px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    fontWeight: 600,
    padding: '4px 8px',
    borderRadius: '4px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  newSearchBtn: {
    marginTop: '16px',
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    color: '#fff',
    padding: '10px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 600,
    border: '1px solid rgba(255,255,255,0.1)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'background 0.2s',
    fontFamily: "'Inter', sans-serif",
  },
  glowRose: {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    width: '256px',
    height: '256px',
    background: 'rgba(244,63,94,0.05)',
    borderRadius: '50%',
    filter: 'blur(64px)',
    transform: 'translate(50%, -50%)',
    pointerEvents: 'none' as const,
  },
  glowOrange: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    width: '192px',
    height: '192px',
    background: 'rgba(251,146,60,0.05)',
    borderRadius: '50%',
    filter: 'blur(64px)',
    transform: 'translate(-33%, 50%)',
    pointerEvents: 'none' as const,
  },
  highlightChips: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px',
  },
};

export default function TravelApp() {
  const {
    step, destination, setDestination,
    budget, setBudget, days, setDays,
    interests, setInterests,
    suggestions, errorMsg, handleSubmit, setStep,
  } = useTravelData();

  const provider = useStore($selectedProvider);
  const providerLabel = provider === 'groq' ? 'Groq' : 'IA local';

  const mi = (name: string, style?: React.CSSProperties) => (
    <span className="material-symbols-rounded" style={style}>{name}</span>
  );

  return (
    <div style={s.wrapper}>
      <div style={s.card}>
        <div style={s.inner}>
          {/* Header */}
          <div style={s.header}>
            <div style={s.iconBoxTravel}>
              {mi('flight_takeoff', s.iconLarge)}
            </div>
            <div>
              <h2 style={s.titleGradient}>Planificador de Viajes</h2>
              <p style={s.subtitle}>100% {providerLabel}</p>
            </div>
          </div>

          {/* Form */}
          {step === 'form' && (
            <form onSubmit={handleSubmit} style={s.form}>
              <div style={s.formFields}>
                {/* Destination */}
                <div style={s.fieldGroup}>
                  <label style={s.label}>Destino</label>
                  <div style={s.inputWrapper}>
                    {mi('location_on', s.inputIcon)}
                    <input
                      required type="text"
                      style={s.input}
                      placeholder="e.g. Kyoto, Japón"
                      value={destination}
                      onChange={e => setDestination(e.target.value)}
                      onFocus={e => { e.target.style.borderColor = 'rgba(251,113,133,0.5)'; e.target.style.background = '#1e293b'; }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'rgba(30,41,59,0.5)'; }}
                    />
                  </div>
                </div>

                {/* Days + Budget */}
                <div style={s.grid2}>
                  <div>
                    <label style={s.label}>Días</label>
                    <div style={s.inputWrapper}>
                      {mi('calendar_today', s.inputIcon)}
                      <input
                        required type="number" min="1" max="30"
                        style={s.input}
                        value={days}
                        onChange={e => setDays(e.target.value)}
                        onFocus={e => { e.target.style.borderColor = 'rgba(251,113,133,0.5)'; e.target.style.background = '#1e293b'; }}
                        onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'rgba(30,41,59,0.5)'; }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={s.label}>Presupuesto</label>
                    <div style={s.inputWrapper}>
                      {mi('payments', s.inputIcon)}
                      <select
                        style={s.select}
                        value={budget}
                        onChange={e => setBudget(e.target.value)}
                        onFocus={e => { e.target.style.borderColor = 'rgba(251,113,133,0.5)'; e.target.style.background = '#1e293b'; }}
                        onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'rgba(30,41,59,0.5)'; }}
                      >
                        <option value="Económico">Económico</option>
                        <option value="Standard">Standard</option>
                        <option value="Lujo">Lujo</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Interests */}
                <div style={s.fieldGroup}>
                  <label style={s.label}>Intereses (opcional)</label>
                  <div style={s.inputWrapper}>
                    {mi('star', s.textareaIcon)}
                    <textarea
                      rows={2}
                      style={s.textarea}
                      placeholder="Museos, comida local, naturaleza..."
                      value={interests}
                      onChange={e => setInterests(e.target.value)}
                      onFocus={e => { e.target.style.borderColor = 'rgba(251,113,133,0.5)'; e.target.style.background = '#1e293b'; }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'rgba(30,41,59,0.5)'; }}
                    />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div style={s.btnWrapper}
                onMouseEnter={(e) => { const g = e.currentTarget.querySelector('[data-glow]') as HTMLElement; if (g) g.style.opacity = '0.6'; }}
                onMouseLeave={(e) => { const g = e.currentTarget.querySelector('[data-glow]') as HTMLElement; if (g) g.style.opacity = '0.3'; }}
              >
                <div data-glow style={s.btnGlow}></div>
                <button
                  type="submit"
                  disabled={!destination.trim()}
                  style={{
                    ...s.btnPrimary,
                    ...(!destination.trim() ? s.btnDisabled : {}),
                    background: !destination.trim() ? 'rgba(30,41,59,0.5)' : 'linear-gradient(to right, #f43f5e, #fb923c)',
                  }}
                >
                  {mi('explore', { fontSize: '20px' })}
                  <span>Descubrir Aventuras</span>
                </button>
              </div>
            </form>
          )}

          {/* Loading */}
          {step === 'loading' && (
            <div style={s.loadingContainer}>
              <div style={s.loadingRelative}>
                {mi('autorenew', s.loadingSpinner)}
                <div style={s.loadingPlane}>
                  {mi('airplanemode_active')}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <h3 style={s.loadingTitle}>Diseñando tu viaje ideal</h3>
                <p style={s.loadingSub}>Consultando {providerLabel}...</p>
              </div>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div style={s.errorContainer}>
              <div style={s.errorIconBox}>
                {mi('error', s.errorIcon)}
              </div>
              <div>
                <h3 style={s.errorTitle}>Vaya, hubo un problema</h3>
                <p style={s.errorMsg}>{errorMsg}</p>
              </div>
              <button
                onClick={() => setStep('form')}
                style={s.retryBtn}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              >
                Intentar de nuevo
              </button>
            </div>
          )}

          {/* Results */}
          {step === 'results' && (
            <div style={s.resultsContainer}>
              <div style={s.resultsScroll}>
                {suggestions.map((sug, i) => (
                  <div key={sug.id || i} style={s.resultCard}>
                    <div style={s.resultHeader}>
                      <h4 style={s.resultTitle}>{sug.title}</h4>
                      <span style={s.costBadge}>{sug.estimatedCost}</span>
                    </div>
                    <p style={s.resultDesc}>{sug.description}</p>
                    {sug.highlights?.length > 0 && (
                      <div style={s.highlightChips}>
                        {sug.highlights.map((hl, j) => (
                          <span key={j} style={s.highlightTag}>
                            {mi('push_pin', { fontSize: '14px', color: '#fb923c' })}
                            {hl}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{
                textAlign: 'center' as const,
                fontSize: '10px',
                color: '#9ca3af',
                padding: '4px 0',
                flexShrink: 0,
              }}>
                Generado con {providerLabel}
              </div>
              <button
                onClick={() => setStep('form')}
                style={s.newSearchBtn}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              >
                {mi('refresh', { fontSize: '18px' })}
                Nueva Búsqueda
              </button>
            </div>
          )}

          {/* Decorative glows */}
          <div style={s.glowRose}></div>
          <div style={s.glowOrange}></div>
        </div>
      </div>
    </div>
  );
}
