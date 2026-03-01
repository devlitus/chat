import { useEffect, useState } from 'react';

export default function McpClientApp() {
  const [serverTime, setServerTime] = useState<string>('Loading...');
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    // Escuchar mensajes del Host Padre
    const handleMessage = (event: MessageEvent) => {
      // Ignorar mensajes intrusivos
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.source && typeof event.data.source === 'string' && event.data.source.includes('devtools')) return;

      const data = event.data;
      if (data.type === 'mcp_tool_result' && data.toolName === 'get-time') {
        const dateStr = data.time;
        if (dateStr) {
          try {
            const date = new Date(dateStr);
            const formatted = date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
            setServerTime(formatted);
          } catch (e) {
            setServerTime(dateStr);
          }
        } else {
          setServerTime('[ERROR: Sin datos]');
        }
        setIsFetching(false);
      }
    };

    window.addEventListener('message', handleMessage);

    // Saludar al padre cuando esté listo, pidiendo la hora inicial
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'mcp_call_tool', toolName: 'get-time' }, '*');
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleGetServerTime = () => {
    setIsFetching(true);
    setServerTime('Actualizando...');
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'mcp_call_tool', toolName: 'get-time' }, '*');
    } else {
      setServerTime('[ERROR: No host]');
      setIsFetching(false);
    }
  };

  return (
    <div className="min-h-screen font-sans flex items-start justify-center p-4 pt-6 sm:pt-10 bg-transparent text-slate-200">
      {/* Tarjeta Glassmorphism */}
      <div className="relative w-full max-w-sm rounded-[2rem] bg-slate-900/40 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden p-8 transition-all duration-500 hover:shadow-cyan-500/10">

        {/* Glow de fondo decorativo animado */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-600 rounded-full mix-blend-multiply filter blur-[64px] opacity-30 animate-pulse"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-600 rounded-full mix-blend-multiply filter blur-[64px] opacity-30 animate-pulse" style={{ animationDelay: '2s' }}></div>

        <div className="relative z-10">
          <div className="flex items-center space-x-4 mb-8">
            <div className="p-2.5 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl shadow-lg border border-white/10">
              <span className="material-symbols-outlined text-white text-[28px] block leading-none">schedule</span>
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-200 tracking-tight leading-none mb-1">
                Live Sync
              </h1>
              <span className="text-xs text-slate-400 font-medium tracking-wide uppercase">MCP Tool Demo</span>
            </div>
          </div>

          <div className="mb-8">
            <p className="text-slate-400 text-xs font-semibold mb-3 tracking-widest pl-1">
              TIEMPO DEL SERVIDOR
            </p>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/30 to-blue-600/30 rounded-2xl blur-md opacity-50 group-hover:opacity-100 transition duration-500"></div>
              <div className="relative bg-black/60 backdrop-blur-sm px-6 py-5 rounded-2xl border border-white/5 flex items-center justify-center min-h-[72px] shadow-inner">
                <code className={`font-mono text-2xl tracking-widest transition-all duration-300 font-semibold ${isFetching ? 'text-cyan-400 animate-pulse scale-95' : 'text-white scale-100 text-shadow-glow'}`}>
                  {serverTime}
                </code>
              </div>
            </div>
          </div>

          <button
            onClick={handleGetServerTime}
            disabled={isFetching}
            className={`group relative w-full flex justify-center py-4 px-6 rounded-2xl text-sm font-bold text-white overflow-hidden transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed ${isFetching ? 'opacity-70 scale-95' : 'hover:scale-[1.02] shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)]'}`}
          >
            <div className="absolute inset-0 w-full h-full bg-slate-800 border border-slate-700 rounded-2xl transition-opacity duration-300"></div>
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-cyan-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            <span className="relative flex items-center gap-2 tracking-wide">
              {isFetching ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                  ACTUALIZANDO...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">update</span>
                  SINCRONIZAR AHORA
                </>
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
